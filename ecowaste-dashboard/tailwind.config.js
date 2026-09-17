/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#0d9668',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b'
        },
        // Align neutrals with the mobile app's gray ramp (was Tailwind's blue-tinted
        // "slate"). All existing `slate-*` utilities now match the native palette:
        //   slate-50  = #F9FAFB (mobile background)
        //   slate-100 = #F3F4F6 (mobile surfaceSecondary)
        //   slate-200 = #E5E7EB (mobile border)
        //   slate-500 = #6B7280 (mobile textSecondary)
        //   slate-700 = #374151 (mobile dark surface)
        //   slate-800 = #1F2937 (mobile text)
        slate: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712'
        },
        // Shared semantic palette (mirrors mobile constants/colors.ts).
        secondary: '#3B82F6',
        accent: '#F59E0B',
        success: '#22C55E',
        warning: '#EAB308',
        error: '#EF4444',
        waste: {
          household: '#8B5CF6',
          plastic: '#3B82F6',
          organic: '#22C55E',
          electronic: '#F59E0B',
          hazardous: '#EF4444',
          metal: '#64748B',
          mixed: '#0F766E',
          recyclable: '#06B6D4'
        }
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.08)'
      },
      borderRadius: {
        xl: '0.9rem'
      }
    }
  },
  plugins: []
};
