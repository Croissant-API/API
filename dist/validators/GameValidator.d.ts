import * as yup from 'yup';
export declare const gameIdParamSchema: yup.ObjectSchema<{
    gameId: string;
}, yup.AnyObject, {
    gameId: undefined;
}, "">;
export declare const createGameBodySchema: yup.ObjectSchema<{
    name: string;
    description: string;
    price: number;
    downloadLink: string;
    image: string;
}, yup.AnyObject, {
    name: undefined;
    description: undefined;
    price: undefined;
    downloadLink: undefined;
    image: undefined;
}, "">;
export declare const updateGameBodySchema: yup.ObjectSchema<{
    name: string | undefined;
    genre: string | undefined;
    releaseDate: Date | undefined;
}, yup.AnyObject, {
    name: undefined;
    genre: undefined;
    releaseDate: undefined;
}, "">;
