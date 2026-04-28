"use client";

import * as React from "react";
import { format, getDay, getDaysInMonth, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    className?: string;
}

function toDate(value: string): Date {
    const parsed = value ? parseISO(`${value}T12:00:00`) : new Date();
    return isValid(parsed) ? parsed : new Date();
}

export function DatePicker({ id, value, onChange, required, className }: DatePickerProps) {
    const [open, setOpen] = React.useState(false);
    const [viewDate, setViewDate] = React.useState(toDate(value));
    const selectedDate = toDate(value);
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(viewDate);
    const firstDayOffset = getDay(new Date(year, month, 1));
    const days = Array.from({ length: firstDayOffset + daysInMonth }, (_, index) =>
        index < firstDayOffset ? null : index - firstDayOffset + 1
    );

    React.useEffect(() => {
        setViewDate(toDate(value));
    }, [value]);

    const selectDay = (day: number) => {
        const next = new Date(year, month, day, 12);
        onChange(format(next, "yyyy-MM-dd"));
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground", className)}
                    aria-required={required}
                >
                    <Calendar className="mr-2 h-4 w-4" />
                    {value ? format(selectedDate, "dd/MM/yyyy", { locale: es }) : "Seleccione fecha"}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[280px] p-3">
                <div className="flex items-center justify-between pb-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewDate(new Date(year, month - 1, 1))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-sm font-medium capitalize">
                        {format(viewDate, "MMMM yyyy", { locale: es })}
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewDate(new Date(year, month + 1, 1))}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
                    {["D", "L", "M", "M", "J", "V", "S"].map((day, index) => (
                        <div key={`${day}-${index}`} className="py-1">{day}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, index) => {
                        const selected = day && selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === day;
                        return day ? (
                            <Button
                                key={day}
                                type="button"
                                variant={selected ? "default" : "ghost"}
                                className="h-8 w-8 p-0"
                                onClick={() => selectDay(day)}
                            >
                                {day}
                            </Button>
                        ) : (
                            <div key={`empty-${index}`} />
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}
