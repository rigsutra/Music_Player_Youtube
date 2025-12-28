import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SongCard from '../../components/SongCard';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Mock dependencies
jest.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }) => <div {...props}>{children}</div>,
    },
}));

jest.mock('react-hot-toast', () => ({
    success: jest.fn(),
    error: jest.fn(),
}));

jest.mock('../../lib/api', () => ({
    delete: jest.fn(),
}));

const theme = createTheme();

const renderWithTheme = (component) => {
    return render(
        <ThemeProvider theme={theme}>
            {component}
        </ThemeProvider>
    );
};

describe('SongCard Component', () => {
    const mockSong = {
        id: '123',
        name: 'Test Song',
        artist: 'Test Artist',
        duration: 180,
        thumbnail: 'test.jpg',
        liked: false,
    };

    const mockOnClick = jest.fn();
    const mockOnSongDeleted = jest.fn();

    it('renders song information correctly', () => {
        renderWithTheme(
            <SongCard
                song={mockSong}
                index={0}
                totalSongs={1}
                onClick={mockOnClick}
                onSongDeleted={mockOnSongDeleted}
            />
        );

        expect(screen.getByText('Test Song')).toBeInTheDocument();
        expect(screen.getByText('Test Artist')).toBeInTheDocument();
        expect(screen.getByText('3:00')).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        renderWithTheme(
            <SongCard
                song={mockSong}
                index={0}
                totalSongs={1}
                onClick={mockOnClick}
                onSongDeleted={mockOnSongDeleted}
            />
        );

        fireEvent.click(screen.getByText('Test Song'));
        expect(mockOnClick).toHaveBeenCalled();
    });

    it('calls onSongDeleted with "like" action when heart is clicked', () => {
        renderWithTheme(
            <SongCard
                song={mockSong}
                index={0}
                totalSongs={1}
                onClick={mockOnClick}
                onSongDeleted={mockOnSongDeleted}
            />
        );

        const likeButton = screen.getByLabelText('Like');
        fireEvent.click(likeButton);
        expect(mockOnSongDeleted).toHaveBeenCalledWith('123', 'like');
    });
});
