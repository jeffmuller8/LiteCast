"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock, type LucideIcon } from "lucide-react";

export interface SortOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
  description: string;
}

interface SortDropdownProps<T extends string> {
  options: SortOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SortDropdown<T extends string>({ options, value, onChange }: SortDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const SelectedIcon = selected?.icon || Clock;

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:text-light-text dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <SelectedIcon className="w-4 h-4" />
        <span>{selected?.label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl z-30 overflow-hidden animate-fadeIn">
          {options.map((option) => {
            const Icon = option.icon;
            const isActive = value === option.value;
            return (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition-colors ${
                  isActive ? "bg-light-primary/10 dark:bg-sky-500/10" : ""
                }`}
              >
                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  isActive ? "text-light-primary dark:text-sky-400" : "text-gray-400 dark:text-zinc-500"
                }`} />
                <div>
                  <p className={`text-sm font-medium ${
                    isActive ? "text-light-primary dark:text-sky-400" : "text-light-text dark:text-white"
                  }`}>
                    {option.label}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
