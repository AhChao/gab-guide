/**
 * Parses the extensions field from API response.
 * Handles both formatted text strings and JSON array strings.
 * 
 * @param extensions - Raw extensions string from API
 * @returns Formatted string for display
 */
export function parseExtensions(extensions: string): string {
    if (!extensions || extensions.trim() === '') {
        return 'No suggestions available.';
    }

    const trimmed = extensions.trim();

    // Check if it's a JSON array string
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                // Format as numbered list
                return parsed
                    .map((item, index) => `${index + 1}. ${item}`)
                    .join('\n');
            }
        } catch (e) {
            // If parsing fails, return as-is
            console.warn('Failed to parse extensions as JSON array:', e);
        }
    }

    // Return as-is if it's already formatted text
    return trimmed;
}
