import React from 'react';
import { AboutBlock, AboutBlockProps } from './AboutBlock';

type AuthorBlockProps = Omit<AboutBlockProps, 'type'>;

const AuthorBlockUI: React.FC<AuthorBlockProps> = (props) => {
    return <AboutBlock type="author" {...props} />;
};

export const AuthorBlock = React.memo(AuthorBlockUI, (prevProps, nextProps) => {
    return (
        prevProps.author?.name === nextProps.author?.name &&
        prevProps.author?.description === nextProps.author?.description &&
        prevProps.author?.image === nextProps.author?.image &&
        prevProps.author?.nationality === nextProps.author?.nationality &&
        prevProps.author?.birthDate === nextProps.author?.birthDate &&
        prevProps.authorName === nextProps.authorName &&
        prevProps.book?.title === nextProps.book?.title
    );
});
