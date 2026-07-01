import React from 'react';
import { AboutBlock, AboutBlockProps } from './AboutBlock';

type BookInfoBlockProps = Omit<AboutBlockProps, 'type'>;

const BookInfoBlockUI: React.FC<BookInfoBlockProps> = (props) => {
    return <AboutBlock type="book" {...props} />;
};

export const BookInfoBlock = React.memo(BookInfoBlockUI, (prevProps, nextProps) => {
    return (
        prevProps.book?.id === nextProps.book?.id &&
        prevProps.book?.title === nextProps.book?.title &&
        prevProps.variant === nextProps.variant
    );
});
