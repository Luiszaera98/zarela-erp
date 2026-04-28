"use client";

import * as React from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface MonthPickerProps {
    currentMonth: string;
    currentYear: string;
    onMonthChange: (month: string) => void;
    onYearChange: (year: string) => void;
    className?: string;
}

export function MonthPicker({
    currentMonth,
    currentYear,
    onMonthChange,
    onYearChange,
    className,
}: MonthPickerProps) {
    // Internal state for browsing years within the menu
    const [viewYear, setViewYear] = React.useState(currentYear);

    // Sync viewYear when the actual selected year changes externally
    React.useEffect(() => {
        setViewYear(currentYear);
    }, [currentYear]);

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

    const handleMonthClick = (monthValue: string) => {
        // When a user selects a month, we commit BOTH the month and the currently viewed year
        onYearChange(viewYear);
        onMonthChange(monthValue);
    };

    const handleYearNavigation = (direction: -1 | 1, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation(); // prevent menu closing
        // Only update the internal view state, do NOT call onYearChange yet
        setViewYear(prev => (parseInt(prev) + direction).toString());
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "w-[180px] justify-start text-left font-normal bg-white dark:bg-card shadow-sm border-input hover:bg-accent hover:text-accent-foreground",
                        className
                    )}
                >
                    <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">
                        {months.find((m) => m.value === currentMonth)?.label} {currentYear}
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[280px] p-0" align="start">
                <div className="flex items-center justify-between p-3 border-b">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleYearNavigation(-1, e)}
                        className="h-7 w-7"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="font-semibold">{viewYear}</div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleYearNavigation(1, e)}
                        className="h-7 w-7"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <div className="grid grid-cols-3 gap-1 p-2">
                    {months.map((month) => (
                        <Button
                            key={month.value}
                            variant={currentMonth === month.value && currentYear === viewYear ? "default" : "ghost"}
                            size="sm"
                            onClick={() => handleMonthClick(month.value)}
                            className={cn(
                                "text-xs h-8",
                                currentMonth === month.value && currentYear === viewYear && "bg-primary text-primary-foreground"
                            )}
                        >
                            {month.label.substring(0, 3)}
                        </Button>
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
