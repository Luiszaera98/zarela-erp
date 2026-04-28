"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, CreditCard, DollarSign, Users, Package, TrendingUp, TrendingDown, AlertTriangle, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { getDashboardAnalytics } from '@/lib/actions/analyticsActions';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MonthPicker } from "@/components/ui/month-picker";

// Corporate Gray Palette
const COLORS = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))'
];

export default function DashboardPage() {
    const currentDate = new Date();
    const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth().toString());
    const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString());
    const [analytics, setAnalytics] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Timezone offset in minutes (e.g. 240 for UTC-4)
                const offset = new Date().getTimezoneOffset();
                const data = await getDashboardAnalytics(selectedMonth, selectedYear, offset);
                setAnalytics(data);
            } catch (error) {
                console.error("Error fetching dashboard data", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [selectedMonth, selectedYear]);

    const months = [
        { value: "0", label: "Enero" },
        { value: "1", label: "Febrero" },
        { value: "2", label: "Marzo" },
        { value: "3", label: "Abril" },
        { value: "4", label: "Mayo" },
        { value: "5", label: "Junio" },
        { value: "6", label: "Julio" },
        { value: "7", label: "Agosto" },
        { value: "8", label: "Septiembre" },
        { value: "9", label: "Octubre" },
        { value: "10", label: "Noviembre" },
        { value: "11", label: "Diciembre" },
    ];

    const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-600"></div>
            </div>
        );
    }

    if (!analytics) return null;

    const { evolutionData, topClientsBilling, topClientsPayment, stockSummary, topExpenses, currentMonthData, lastYearData, lastYearDataMTD } = analytics;

    const comparisonData = lastYearDataMTD || lastYearData;

    return (
        <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 bg-background min-h-screen">
            {/* Header & Filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">Panel de Control</h2>
                    <p className="text-muted-foreground text-sm mt-1">Visión general del rendimiento financiero.</p>
                </div>
                <div className="flex items-center gap-3">
                    <MonthPicker
                        currentMonth={selectedMonth}
                        currentYear={selectedYear}
                        onMonthChange={setSelectedMonth}
                        onYearChange={setSelectedYear}
                    />
                </div>
            </div>

            {/* Key Metrics Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

                {/* 1. Flujo de Caja (Mes) */}
                <Card className="border-border shadow-sm bg-card hover:shadow-md transition-all duration-200 ring-1 ring-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Flujo de Caja (Mes)</CardTitle>
                        <div className={cn("p-2 rounded-lg", ((currentMonthData?.collected || 0) - (analytics?.expensesPaid || 0)) >= 0 ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-rose-100 dark:bg-rose-900/30")}>
                            <DollarSign className={cn("h-4 w-4", ((currentMonthData?.collected || 0) - (analytics?.expensesPaid || 0)) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={cn("text-2xl font-bold mt-2", ((currentMonthData?.collected || 0) - (analytics?.expensesPaid || 0)) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600")}>
                            ${((currentMonthData?.collected || 0) - (analytics?.expensesPaid || 0)).toLocaleString('es-DO', { maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium leading-tight">
                            Ingresos: ${(currentMonthData?.collected || 0).toLocaleString('es-DO', { maximumFractionDigits: 0 })} - Pagos: ${(analytics?.expensesPaid || 0).toLocaleString('es-DO', { maximumFractionDigits: 0 })}
                        </p>
                    </CardContent>
                </Card>

                {/* 2. Solvencia Total (Patrimonio) */}
                <Card className="border-border shadow-sm bg-card hover:shadow-md transition-all duration-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Solvencia Total</CardTitle>
                        <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
                            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground mt-2">
                            ${(analytics?.globalBalance?.net || 0).toLocaleString('es-DO', { maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium leading-tight">
                            (Inventario + CxC) - Deudas
                        </p>
                    </CardContent>
                </Card>

                {/* 3. Cuentas por Pagar (Alerta) */}
                <Card className="border-border shadow-sm bg-card hover:shadow-md transition-all duration-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Cuentas por Pagar</CardTitle>
                        <div className="p-2 bg-rose-100 rounded-lg dark:bg-rose-900/30">
                            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">
                            ${(analytics?.globalBalance?.payables || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            Pendientes: ${(analytics?.globalBalance?.payablesBreakdown?.['Pendiente'] || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + Parciales: ${(analytics?.globalBalance?.payablesBreakdown?.['Parcial'] || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </CardContent>
                </Card>

                {/* 4. Valor en Inventario */}
                <Card className="border-border shadow-sm bg-card hover:shadow-md transition-all duration-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Valor en Inventario</CardTitle>
                        <div className="p-2 bg-muted rounded-lg">
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground mt-2">
                            ${stockSummary.totalValue.toLocaleString('es-DO', { maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            {stockSummary.totalItems} productos en stock
                        </p>
                    </CardContent>
                </Card>

                {/* 5. Ingresos Reales (MetricCard) */}
                <MetricCard
                    title="Ingresos del Mes"
                    value={currentMonthData?.collected || 0}
                    previousValue={comparisonData?.collected || 0}
                    isMTD={comparisonData?.isMTD}
                    icon={CreditCard}
                    color="slate"
                    metrics={analytics?.metrics?.collected}
                />

                {/* 6. Gastos Totales (MetricCard) */}
                <MetricCard
                    title="Gastos del Mes"
                    value={currentMonthData?.expenses || 0}
                    previousValue={comparisonData?.expenses || 0}
                    isMTD={comparisonData?.isMTD}
                    icon={TrendingDown}
                    color="slate"
                    metrics={analytics?.metrics?.expenses}
                />
            </div>

            {/* Evolution Charts */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Invoiced vs Expenses Chart */}
                <Card className="border-border shadow-sm bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold text-foreground">Facturación vs Gastos</CardTitle>
                        <CardDescription className="text-muted-foreground">Comparativa de facturación y gastos</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-0 pt-4">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={evolutionData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis
                                        dataKey="month"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                        domain={[0, 'dataMax + 50000']}
                                    />
                                    <Tooltip
                                        cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
                                        formatter={(value: number) => [`$${value.toLocaleString('es-DO', { maximumFractionDigits: 0 })}`, '']}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} iconType="circle" iconSize={8} />
                                    <Line type="monotone" dataKey="invoiced" name="Facturado" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--background))' }} activeDot={{ r: 6 }} />
                                    <Line type="monotone" dataKey="expenses" name="Gastos" stroke="hsl(var(--destructive))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--destructive))', strokeWidth: 2, stroke: 'hsl(var(--background))' }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Collected vs Expenses Chart */}
                <Card className="border-border shadow-sm bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold text-foreground">Cobrado vs Gastos</CardTitle>
                        <CardDescription className="text-muted-foreground">Comparativa de flujo de caja y gastos</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-0 pt-4">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={evolutionData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                    <XAxis
                                        dataKey="month"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                                        domain={[0, 'dataMax + 50000']}
                                    />
                                    <Tooltip
                                        cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
                                        formatter={(value: number) => [`$${value.toLocaleString('es-DO', { maximumFractionDigits: 0 })}`, '']}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} iconType="circle" iconSize={8} />
                                    <Line type="monotone" dataKey="collected" name="Cobrado" stroke="hsl(var(--chart-2))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--chart-2))', strokeWidth: 2, stroke: 'hsl(var(--background))' }} activeDot={{ r: 6 }} />
                                    <Line type="monotone" dataKey="expenses" name="Gastos" stroke="hsl(var(--destructive))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--destructive))', strokeWidth: 2, stroke: 'hsl(var(--background))' }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Top Clients - Billing */}
                <Card className="col-span-4 lg:col-span-3 border-border shadow-sm bg-card">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-foreground">Top Clientes</CardTitle>
                        <CardDescription className="text-muted-foreground">Por facturación este mes</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-border">
                                    <TableHead className="w-[50px] text-muted-foreground font-medium">#</TableHead>
                                    <TableHead className="text-muted-foreground font-medium">Cliente</TableHead>
                                    <TableHead className="text-right text-muted-foreground font-medium">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {topClientsBilling.map((client: any, index: number) => (
                                    <TableRow key={index} className="hover:bg-muted/50 border-border">
                                        <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                                        <TableCell className="font-medium text-foreground">{client.name}</TableCell>
                                        <TableCell className="text-right font-semibold text-foreground">
                                            ${client.value.toLocaleString('es-DO', { maximumFractionDigits: 0 })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {topClientsBilling.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                            Sin datos disponibles
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Top Clients - Payment */}
                <Card className="col-span-4 lg:col-span-4 border-border shadow-sm bg-card">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-foreground">Mejores Pagadores</CardTitle>
                        <CardDescription className="text-muted-foreground">Por pagos recibidos este mes</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-border">
                                    <TableHead className="w-[50px] text-muted-foreground font-medium">#</TableHead>
                                    <TableHead className="text-muted-foreground font-medium">Cliente</TableHead>
                                    <TableHead className="text-right text-muted-foreground font-medium">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {topClientsPayment.map((client: any, index: number) => (
                                    <TableRow key={index} className="hover:bg-muted/50 border-border">
                                        <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                                        <TableCell className="font-medium text-foreground">{client.name}</TableCell>
                                        <TableCell className="text-right font-semibold text-foreground">
                                            ${client.value.toLocaleString('es-DO', { maximumFractionDigits: 0 })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {topClientsPayment.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                            Sin datos disponibles
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Top Expenses */}
                <Card className="col-span-4 lg:col-span-3 border-border shadow-sm bg-card">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-foreground">Gastos por Categoría</CardTitle>
                        <CardDescription className="text-muted-foreground">Distribución mensual</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={topExpenses}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {topExpenses.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => `$${value.toLocaleString('es-DO', { maximumFractionDigits: 0 })}`}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            {topExpenses.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                                    Sin gastos registrados
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Stock Summary */}
                <Card className="col-span-4 lg:col-span-4 border-border shadow-sm bg-card">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-foreground">Alertas de Inventario</CardTitle>
                        <CardDescription className="text-muted-foreground">Productos que requieren atención</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            <div className="flex items-start p-4 bg-muted/50 rounded-xl border border-border">
                                <div className="p-2 bg-muted rounded-lg mr-4 mt-0.5">
                                    <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">Stock Bajo Detectado</p>
                                    <p className="text-sm text-muted-foreground">
                                        Actualmente hay <strong>{stockSummary.lowStockCount}</strong> productos por debajo del nivel mínimo de inventario. Se recomienda reabastecer pronto.
                                    </p>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Top Valoración</h4>
                                <div className="space-y-3">
                                    {stockSummary.topProductsValuation.map((product: any, index: number) => (
                                        <div key={index} className="flex justify-between items-center text-sm p-3 bg-muted/30 rounded-lg border border-border">
                                            <span className="font-medium text-foreground">{product.name}</span>
                                            <span className="font-semibold text-muted-foreground">${product.value.toLocaleString('es-DO', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function MetricCard({ title, value, previousValue, isMTD, icon: Icon, color, metrics }: any) {
    // Simplified to just slate/gray theme
    const theme = { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' };
    const difference = value - previousValue;
    const isPositive = difference >= 0;

    const mom = metrics?.mom || 0;
    const l3m = metrics?.l3mComparison || 0;

    return (
        <Card className="border-border shadow-sm bg-card hover:shadow-md transition-all duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <div className={`p-2 rounded-lg ${theme.bg}`}>
                    <Icon className={`h-4 w-4 ${theme.text}`} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-foreground mt-2">
                    ${value.toLocaleString('es-DO', { maximumFractionDigits: 0 })}
                </div>

                <div className="flex flex-col gap-1 mt-2">
                    {/* Last Year Comparison */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">vs Año Ant. {isMTD ? '(MTD)' : ''}</span>
                        <div className="flex items-center">
                            {previousValue > 0 ? (
                                <span className={cn("font-medium flex items-center", isPositive ? "text-emerald-600" : "text-rose-600")}>
                                    {isPositive ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                                    {((difference / previousValue) * 100).toFixed(0)}%
                                </span>
                            ) : <span className="text-muted-foreground">-</span>}
                        </div>
                    </div>

                    {/* MoM Comparison */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">vs Mes Ant.</span>
                        <div className="flex items-center">
                            <span className={cn("font-medium flex items-center", mom >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                {mom >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                                {mom.toFixed(0)}%
                            </span>
                        </div>
                    </div>

                    {/* L3M Comparison */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">vs Prom. 3M</span>
                        <div className="flex items-center">
                            <span className={cn("font-medium flex items-center", l3m >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                {l3m >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                                {l3m.toFixed(0)}%
                            </span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
