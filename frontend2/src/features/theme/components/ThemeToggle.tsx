import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeProvider';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const handleToggle = () => {
        setTheme(isDark ? 'light' : 'dark');
    };

    return (
        <button
            onClick={handleToggle}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--secondary)] text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
            title={isDark ? "라이트 모드로 변경" : "다크 모드로 변경"}
        >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </button>
    );
}
