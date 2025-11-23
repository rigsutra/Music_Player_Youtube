import { formatTime, formatFileSize, cn } from '../lib/utils';

describe('Utility Functions', () => {
    describe('formatTime', () => {
        it('formats seconds correctly', () => {
            expect(formatTime(65)).toBe('1:05');
            expect(formatTime(0)).toBe('0:00');
            expect(formatTime(3600)).toBe('60:00');
        });

        it('handles invalid input', () => {
            expect(formatTime(null)).toBe('0:00');
            expect(formatTime(undefined)).toBe('0:00');
            expect(formatTime(NaN)).toBe('0:00');
        });
    });

    describe('formatFileSize', () => {
        it('formats bytes correctly', () => {
            expect(formatFileSize(1024)).toBe('1.0 KB');
            expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
            expect(formatFileSize(500)).toBe('500.0 B');
        });

        it('handles empty input', () => {
            expect(formatFileSize(0)).toBe('');
            expect(formatFileSize(null)).toBe('');
        });
    });

    describe('cn', () => {
        it('merges classes correctly', () => {
            expect(cn('class1', 'class2')).toBe('class1 class2');
            expect(cn('class1', null, 'class2')).toBe('class1 class2');
            expect(cn('class1', false && 'class2')).toBe('class1');
        });
    });
});
