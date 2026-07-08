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
        prevProps.book?.description === nextProps.book?.description &&
        prevProps.book?.cover === nextProps.book?.cover &&
        prevProps.book?.year === nextProps.book?.year &&
        prevProps.book?.pages === nextProps.book?.pages &&
        prevProps.book?.rating === nextProps.book?.rating &&
        prevProps.book?.genre === nextProps.book?.genre &&
        prevProps.variant === nextProps.variant
    );
});
