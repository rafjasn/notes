'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const ThemeToggleButton: React.FC = () => {
    const { toggleTheme } = useTheme();

    return (
        <button
            aria-label="Toggle color theme"
            onClick={toggleTheme}
            className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-dark-900 h-11 w-11 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            type="button"
        >
            <Sun className="hidden size-5 dark:block" />
            <Moon className="size-5 dark:hidden" />
        </button>
    );
};
