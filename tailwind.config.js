/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
    theme: {
        extend: {
            fontSize: {
                xs: ['var(--text-xs)', { lineHeight: 'var(--leading-none)' }],
                sm: ['var(--text-sm)', { lineHeight: 'var(--leading-tight)' }],
                base: ['var(--text-base)', { lineHeight: 'var(--leading-normal)' }],
                lg: ['var(--text-lg)', { lineHeight: 'var(--leading-relaxed)' }],
                xl: ['var(--text-xl)', { lineHeight: 'var(--leading-relaxed)' }],
                '2xl': ['var(--text-2xl)', { lineHeight: 'var(--leading-tight)' }],
                '3xl': ['var(--text-3xl)', { lineHeight: 'var(--leading-tight)' }],
                '4xl': ['var(--text-4xl)', { lineHeight: 'var(--leading-tight)' }],
                '5xl': ['var(--text-5xl)', { lineHeight: 'var(--leading-none)' }],
                '6xl': ['var(--text-6xl)', { lineHeight: 'var(--leading-none)' }],
            },
            letterSpacing: {
                tighter: 'var(--tracking-tighter)',
                tight: 'var(--tracking-tight)',
                normal: 'var(--tracking-normal)',
                wide: 'var(--tracking-wide)',
                widest: 'var(--tracking-widest)',
            },
            lineHeight: {
                none: 'var(--leading-none)',
                tight: 'var(--leading-tight)',
                snug: 'var(--leading-snug)',
                normal: 'var(--leading-normal)',
                relaxed: 'var(--leading-relaxed)',
                loose: 'var(--leading-loose)',
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                }
            }
        }
    },
    plugins: [require("tailwindcss-animate")],
}
