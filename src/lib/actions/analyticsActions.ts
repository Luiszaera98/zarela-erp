"use server";

import dbConnect from '@/lib/db';
import { Invoice as InvoiceModel, Payment as PaymentModel, Expense as ExpenseModel, Product as ProductModel, ExpenseTransaction as ExpenseTransactionModel } from '@/models';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';

export async function getDashboardAnalytics(month?: string, year?: string, timezoneOffset: number = 0) {
    await dbConnect();

    const offsetMs = timezoneOffset * 60 * 1000;
    const nowLocal = new Date();

    let baseYear = nowLocal.getFullYear();
    let baseMonth = nowLocal.getMonth();

    if (month && year) {
        baseYear = parseInt(year);
        baseMonth = parseInt(month);
    }

    // 1. Evolution (Last 4 months relative to selected date + Same month last year)
    const monthsToFetch = [3, 2, 1, 0];
    const evolutionData = [];

    for (const i of monthsToFetch) {
        // Calculate target month (going back 'i' months)
        // Adjust year/month math handles negative months automatically
        const targetDate = new Date(Date.UTC(baseYear, baseMonth - i, 1) + offsetMs);
        const y = targetDate.getUTCFullYear();
        const m = targetDate.getUTCMonth();

        // Exact start/end in UTC
        const startUTC = Date.UTC(y, m, 1);
        const endUTC = Date.UTC(y, m + 1, 0, 23, 59, 59, 999);

        // Apply Timezone Offset to get the query range
        const start = new Date(startUTC + offsetMs);
        const end = new Date(endUTC + offsetMs);

        const invoices = await InvoiceModel.aggregate([
            { $match: { date: { $gte: start, $lte: end }, status: { $ne: 'Anulada' } } },
            { $group: { _id: null, total: { $sum: "$total" } } }
        ]);

        const payments = await PaymentModel.aggregate([
            { $match: { paymentDate: { $gte: start, $lte: end } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        const expenses = await ExpenseModel.aggregate([
            { $match: { date: { $gte: start, $lte: end } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        evolutionData.push({
            month: format(targetDate, 'MMM yyyy', { locale: es }),
            rawDate: targetDate.toISOString(),
            invoiced: invoices[0]?.total || 0,
            collected: payments[0]?.total || 0,
            expenses: expenses[0]?.total || 0,
            isLastYear: false
        });
    }

    // Fetch same month last year
    const lastYearDate = new Date(Date.UTC(baseYear - 1, baseMonth, 1) + offsetMs);
    const lyY = lastYearDate.getUTCFullYear();
    const lyM = lastYearDate.getUTCMonth();

    const lastYearStart = new Date(Date.UTC(lyY, lyM, 1) + offsetMs);
    const lastYearEnd = new Date(Date.UTC(lyY, lyM + 1, 0, 23, 59, 59, 999) + offsetMs);

    const lastYearInvoices = await InvoiceModel.aggregate([
        { $match: { date: { $gte: lastYearStart, $lte: lastYearEnd }, status: { $ne: 'Anulada' } } },
        { $group: { _id: null, total: { $sum: "$total" } } }
    ]);

    const lastYearPayments = await PaymentModel.aggregate([
        { $match: { paymentDate: { $gte: lastYearStart, $lte: lastYearEnd } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const lastYearExpenses = await ExpenseModel.aggregate([
        { $match: { date: { $gte: lastYearStart, $lte: lastYearEnd } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    evolutionData.push({
        month: format(lastYearDate, 'MMM yyyy', { locale: es }),
        rawDate: lastYearDate.toISOString(),
        invoiced: lastYearInvoices[0]?.total || 0,
        collected: lastYearPayments[0]?.total || 0,
        expenses: lastYearExpenses[0]?.total || 0,
        isLastYear: true
    });

    evolutionData.sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());

    // Current Month Range for Top Charts
    const currentStart = new Date(Date.UTC(baseYear, baseMonth, 1) + offsetMs);
    const currentEnd = new Date(Date.UTC(baseYear, baseMonth + 1, 0, 23, 59, 59, 999) + offsetMs);

    // 2. Top 5 Clients (Selected Month)
    const topClientsBilling = await InvoiceModel.aggregate([
        { $match: { date: { $gte: currentStart, $lte: currentEnd }, status: { $ne: 'Anulada' } } },
        { $group: { _id: "$clientName", total: { $sum: "$total" } } },
        { $sort: { total: -1 } },
        { $limit: 5 }
    ]);

    const topClientsPayment = await PaymentModel.aggregate([
        { $match: { paymentDate: { $gte: currentStart, $lte: currentEnd } } },
        {
            $lookup: {
                from: "invoices",
                localField: "invoiceNumber",
                foreignField: "number",
                as: "invoice"
            }
        },
        { $unwind: "$invoice" },
        { $group: { _id: "$invoice.clientName", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
        { $limit: 5 }
    ]);

    // 3. Stock Summary
    const products = await ProductModel.find({});
    const stockSummary = {
        totalValue: products.reduce((acc, p) => acc + (p.stock * p.price), 0),
        totalItems: products.reduce((acc, p) => acc + p.stock, 0),
        lowStockCount: products.filter(p => p.stock <= p.minStock).length,
        topProductsValuation: [...products]
            .sort((a, b) => (b.stock * b.price) - (a.stock * a.price))
            .slice(0, 5)
            .map(p => ({ name: p.name, value: p.stock * p.price }))
    };

    // 4. Top 5 Expenses (Selected Month)
    const topExpenses = await ExpenseModel.aggregate([
        { $match: { date: { $gte: currentStart, $lte: currentEnd } } },
        { $group: { _id: "$category", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
        { $limit: 5 }
    ]);

    // 5. Last Year Comparison (MTD)
    // MTD means "Month to Date". If selected month is Oct, and today is Nov 10. MTD is Oct 1-31 (full month).
    // If selected month is Nov (current), and today is Nov 10. MTD is Nov 1-10.

    const isCurrentMonth = (baseYear === nowLocal.getFullYear() && baseMonth === nowLocal.getMonth());

    // MTD End Date Calculation
    // Start of Last Year Month
    const lyStartMTD = new Date(Date.UTC(baseYear - 1, baseMonth, 1) + offsetMs);
    let lyEndMTD;

    if (isCurrentMonth) {
        // If current month, cap at same day number
        const currentDay = nowLocal.getDate();
        // Last year, same month, same day, at end of day
        // Note: Using Date.UTC to get the timestamp, then adding offset
        lyEndMTD = new Date(Date.UTC(baseYear - 1, baseMonth, currentDay, 23, 59, 59, 999) + offsetMs);
    } else {
        // If past month, use full month
        lyEndMTD = new Date(Date.UTC(baseYear - 1, baseMonth + 1, 0, 23, 59, 59, 999) + offsetMs);
    }

    const lastYearInvoicesMTD = await InvoiceModel.aggregate([
        { $match: { date: { $gte: lyStartMTD, $lte: lyEndMTD }, status: { $ne: 'Anulada' } } },
        { $group: { _id: null, total: { $sum: "$total" } } }
    ]);

    const lastYearPaymentsMTD = await PaymentModel.aggregate([
        { $match: { paymentDate: { $gte: lyStartMTD, $lte: lyEndMTD } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const lastYearExpensesMTD = await ExpenseModel.aggregate([
        { $match: { date: { $gte: lyStartMTD, $lte: lyEndMTD } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const lastYearDataMTD = {
        invoiced: lastYearInvoicesMTD[0]?.total || 0,
        collected: lastYearPaymentsMTD[0]?.total || 0,
        expenses: lastYearExpensesMTD[0]?.total || 0,
        isMTD: isCurrentMonth
    };

    const currentMonthEntry = evolutionData
        .filter(d => !d.isLastYear)
        .sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime())[0];

    const lastYearEntry = evolutionData.find(d => d.isLastYear);

    const timelineData = evolutionData.filter(d => !d.isLastYear);
    const currentMonth = timelineData[timelineData.length - 1] || { invoiced: 0, collected: 0, expenses: 0 };
    const prevMonth = timelineData[timelineData.length - 2] || { invoiced: 0, collected: 0, expenses: 0 };

    const l3mData = timelineData.slice(0, timelineData.length - 1);
    const l3mAverages = {
        invoiced: l3mData.reduce((acc, curr) => acc + curr.invoiced, 0) / (l3mData.length || 1),
        collected: l3mData.reduce((acc, curr) => acc + curr.collected, 0) / (l3mData.length || 1),
        expenses: l3mData.reduce((acc, curr) => acc + curr.expenses, 0) / (l3mData.length || 1),
    };

    const metrics = {
        invoiced: {
            current: currentMonth.invoiced,
            mom: prevMonth.invoiced ? ((currentMonth.invoiced - prevMonth.invoiced) / prevMonth.invoiced) * 100 : 0,
            l3mComparison: l3mAverages.invoiced ? ((currentMonth.invoiced - l3mAverages.invoiced) / l3mAverages.invoiced) * 100 : 0,
            lastYearComparison: lastYearEntry?.invoiced ? ((currentMonth.invoiced - lastYearEntry.invoiced) / lastYearEntry.invoiced) * 100 : 0
        },
        collected: {
            current: currentMonth.collected,
            mom: prevMonth.collected ? ((currentMonth.collected - prevMonth.collected) / prevMonth.collected) * 100 : 0,
            l3mComparison: l3mAverages.collected ? ((currentMonth.collected - l3mAverages.collected) / l3mAverages.collected) * 100 : 0,
            lastYearComparison: lastYearEntry?.collected ? ((currentMonth.collected - lastYearEntry.collected) / lastYearEntry.collected) * 100 : 0
        },
        expenses: {
            current: currentMonth.expenses,
            mom: prevMonth.expenses ? ((currentMonth.expenses - prevMonth.expenses) / prevMonth.expenses) * 100 : 0,
            l3mComparison: l3mAverages.expenses ? ((currentMonth.expenses - l3mAverages.expenses) / l3mAverages.expenses) * 100 : 0,
            lastYearComparison: lastYearEntry?.expenses ? ((currentMonth.expenses - lastYearEntry.expenses) / lastYearEntry.expenses) * 100 : 0
        }
    };

    // 6. Global Balances (Snapshot)
    const receivables = await InvoiceModel.aggregate([
        { $match: { status: { $in: ['Pendiente', 'Parcial', 'Nota de Crédito Parcial', 'Vencida'] } } },
        { $group: { _id: null, total: { $sum: { $subtract: ["$total", { $ifNull: ["$paidAmount", 0] }] } } } }
    ]);
    const totalReceivables = receivables[0]?.total || 0;

    const payables = await ExpenseModel.aggregate([
        { $match: { status: { $ne: 'Pagada' } } },
        { $group: { _id: null, total: { $sum: { $subtract: ["$amount", { $ifNull: ["$paidAmount", 0] }] } } } }
    ]);
    const totalPayables = payables[0]?.total || 0;

    // Breakdown for debugging
    const payablesBreakdownStats = await ExpenseModel.aggregate([
        { $match: { status: { $ne: 'Pagada' } } },
        { $group: { _id: "$status", total: { $sum: { $subtract: ["$amount", { $ifNull: ["$paidAmount", 0] }] } } } }
    ]);
    const payablesBreakdown = payablesBreakdownStats.reduce((acc, curr) => ({ ...acc, [curr._id || 'Sin Status']: curr.total }), {});

    const netBalance = (totalReceivables + stockSummary.totalValue) - totalPayables;

    // 7. Actual Expenses Paid (Cash Flow Out)
    const expensesPaidAgg = await ExpenseTransactionModel.aggregate([
        { $match: { date: { $gte: currentStart, $lte: currentEnd } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const expensesPaid = expensesPaidAgg[0]?.total || 0;

    return {
        evolutionData,
        currentMonthData: currentMonthEntry || { invoiced: 0, collected: 0, expenses: 0 },
        lastYearData: lastYearEntry || { invoiced: 0, collected: 0, expenses: 0 },
        lastYearDataMTD,
        metrics,
        topClientsBilling: topClientsBilling.map(c => ({ name: c._id, value: c.total })),
        topClientsPayment: topClientsPayment.map(c => ({ name: c._id, value: c.total })),
        stockSummary,
        topExpenses: topExpenses.map(e => ({ name: e._id, value: e.total })),
        globalBalance: {
            receivables: totalReceivables,
            payables: totalPayables,
            payablesBreakdown, // Return breakdown
            net: netBalance,
            inventory: stockSummary.totalValue
        },
        expensesPaid
    };
}
