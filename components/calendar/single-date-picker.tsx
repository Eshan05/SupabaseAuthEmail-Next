'use client'

import * as React from 'react'
import { format, getMonth, getYear, isValid, setMonth, setYear } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar-dropdown'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { ButtonProps } from 'react-day-picker'

interface SingleDatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  startYear?: number
  endYear?: number
  buttonProps?: Omit<ButtonProps, 'variant' | 'className' | 'children' | 'onClick'> & {
    variant?: ButtonProps['variant'];
    className?: string;
  };
  buttonClasses?: string
  formatDateType?: string
  placeholder?: string;
}
export function SingleDatePicker({
  date, // Controlled state: Current date value
  setDate, // Controlled state: Function to update the date
  startYear: customStartYear, // Rename to avoid conflict
  endYear: customEndYear,     // Rename to avoid conflict
  buttonClasses,
  buttonProps = { variant: 'outline' }, // Default variant
  formatDateType = 'PPP',
  placeholder = "Pick a date",
}: SingleDatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const effectiveDate = date ?? new Date();
  const startYear = customStartYear ?? getYear(effectiveDate) - 100;
  const endYear = customEndYear ?? getYear(effectiveDate) + 100;

  // State for the month/year displayed in the calendar view
  // Initialize based on the selected date, or fallback to current month/year
  const [displayMonth, setDisplayMonth] = React.useState<Date>(date ?? new Date());

  // Ensure displayMonth updates if the external date prop changes
  React.useEffect(() => {
    // Only update if the date prop is valid and different from current display month's year/month
    // Or if the date prop becomes undefined (cleared)
    if ((date && isValid(date) && (getYear(date) !== getYear(displayMonth) || getMonth(date) !== getMonth(displayMonth))) || (!date && displayMonth !== null)) {
      setDisplayMonth(date ?? new Date());
    }
    // Optimization: If date is undefined and displayMonth is already based on new Date(), don't reset
    else if (!date && getYear(displayMonth) === getYear(new Date()) && getMonth(displayMonth) === getMonth(new Date())) {
      // No need to update if date is cleared and display is already current month
    }

  }, [date]); // Rerun when the controlled date prop changes


  const months = React.useMemo(() => Array.from({ length: 12 }, (_, i) => format(setMonth(new Date(), i), 'MMMM')), []);
  const years = React.useMemo(() => Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i), [startYear, endYear]);


  const handleMonthChange = (monthStr: string) => {
    const monthIndex = months.indexOf(monthStr);
    if (monthIndex !== -1) {
      setDisplayMonth((prev) => setMonth(prev, monthIndex));
    }
  };

  const handleYearChange = (yearStr: string) => {
    const year = parseInt(yearStr, 10);
    if (!isNaN(year)) {
      setDisplayMonth((prev) => setYear(prev, year));
    }
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate); // Update parent state
    // setIsOpen(false); // Close popover on selection
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          {...buttonProps} // Spread buttonProps first
          variant={buttonProps?.variant ?? 'outline'} // Ensure variant is applied
          className={cn(
            'w-40 justify-start text-left font-normal', // Default width full
            !date && 'text-muted-foreground', // Style if no date
            buttonClasses, // Apply custom classes passed in props
            buttonProps?.className // Apply className from buttonProps last
          )}
        >
          <CalendarIcon className='mr-2 h-4 w-4' />
          {date ? format(date, `${formatDateType}`) : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0'>
        <div className='flex justify-center items-center gap-1 absolute w-full p-2 -mb-2'>
          <Select onValueChange={handleMonthChange} value={months[getMonth(displayMonth)]}>
            <SelectTrigger className='w-max cursor-pointer p-2 focus:ring-offset-0 hover:bg-secondary'>
              <SelectValue placeholder='Month' className='' />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={handleYearChange} value={getYear(displayMonth).toString()}>
            <SelectTrigger className='w-max cursor-pointer p-2 focus:ring-offset-0 hover:bg-secondary'>
              <SelectValue placeholder='Year' />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()} className=''>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Calendar
          mode='single'
          selected={date} // Use the controlled date prop
          onSelect={handleDateSelect} // Use the controlled setDate prop via handler
          month={displayMonth} // Control the displayed month
          onMonthChange={setDisplayMonth} // Update the displayed month view
          // Remove captionLayout="dropdown-buttons" if using custom dropdowns above
          // captionLayout="dropdown-buttons" // Use built-in dropdowns if preferred
          // fromYear={startYear} // Pass year range to built-in dropdowns
          // toYear={endYear}     // Pass year range to built-in dropdowns
          initialFocus
          numberOfMonths={1}
        />
        <div className="p-2 border-t text-right">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDateSelect(undefined)} // Call handler with undefined
            disabled={!date} // Disable if no date is selected
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
