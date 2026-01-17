/**
 * Language utilities for ISO 639-1 codes and display
 */

// Map language names to ISO 639-1 codes
export const LANGUAGE_ISO_MAP: Record<string, string> = {
    'Afrikaans': 'AF',
    'Albanian': 'SQ',
    'Amharic': 'AM',
    'Arabic': 'AR',
    'Armenian': 'HY',
    'Azerbaijani': 'AZ',
    'Basque': 'EU',
    'Belarusian': 'BE',
    'Bengali': 'BN',
    'Bosnian': 'BS',
    'Bulgarian': 'BG',
    'Catalan': 'CA',
    'Chinese': 'ZH',
    'Croatian': 'HR',
    'Czech': 'CS',
    'Danish': 'DA',
    'Dutch': 'NL',
    'English': 'EN',
    'Estonian': 'ET',
    'Filipino': 'TL',
    'Finnish': 'FI',
    'French': 'FR',
    'Galician': 'GL',
    'Georgian': 'KA',
    'German': 'DE',
    'Greek': 'EL',
    'Gujarati': 'GU',
    'Hebrew': 'HE',
    'Hindi': 'HI',
    'Hungarian': 'HU',
    'Icelandic': 'IS',
    'Indonesian': 'ID',
    'Irish': 'GA',
    'Italian': 'IT',
    'Japanese': 'JA',
    'Kannada': 'KN',
    'Kazakh': 'KK',
    'Khmer': 'KM',
    'Korean': 'KO',
    'Kurdish': 'KU',
    'Lao': 'LO',
    'Latvian': 'LV',
    'Lithuanian': 'LT',
    'Macedonian': 'MK',
    'Malay': 'MS',
    'Malayalam': 'ML',
    'Marathi': 'MR',
    'Mongolian': 'MN',
    'Nepali': 'NE',
    'Norwegian': 'NO',
    'Persian': 'FA',
    'Polish': 'PL',
    'Portuguese': 'PT',
    'Punjabi': 'PA',
    'Romanian': 'RO',
    'Russian': 'RU',
    'Serbian': 'SR',
    'Sinhala': 'SI',
    'Slovak': 'SK',
    'Slovenian': 'SL',
    'Spanish': 'ES',
    'Swahili': 'SW',
    'Swedish': 'SV',
    'Tamil': 'TA',
    'Telugu': 'TE',
    'Thai': 'TH',
    'Turkish': 'TR',
    'Ukrainian': 'UK',
    'Urdu': 'UR',
    'Uzbek': 'UZ',
    'Vietnamese': 'VI',
    'Welsh': 'CY',
    'Yiddish': 'YI',
    'Zulu': 'ZU',
};

// Unique colors for common languages, gray for others
export const LANGUAGE_COLORS: Record<string, string> = {
    'EN': '#3B82F6', // Blue - English
    'JA': '#EF4444', // Red - Japanese
    'ES': '#F59E0B', // Amber - Spanish
    'ZH': '#10B981', // Emerald - Chinese
    'FR': '#8B5CF6', // Violet - French
    'DE': '#EC4899', // Pink - German
    'KO': '#14B8A6', // Teal - Korean
    'PT': '#22C55E', // Green - Portuguese
    'IT': '#06B6D4', // Cyan - Italian
    'RU': '#6366F1', // Indigo - Russian
    'AR': '#84CC16', // Lime - Arabic
    'HI': '#F97316', // Orange - Hindi
};

const DEFAULT_COLOR = '#6B7280'; // Gray for custom/other languages

/**
 * Get ISO 639-1 code from language name
 */
export const getLanguageCode = (language: string | undefined): string => {
    if (!language) return 'EN';
    const normalized = language.trim();
    return LANGUAGE_ISO_MAP[normalized] || normalized.substring(0, 2).toUpperCase();
};

/**
 * Get color for language code
 */
export const getLanguageColor = (code: string): string => {
    return LANGUAGE_COLORS[code] || DEFAULT_COLOR;
};
