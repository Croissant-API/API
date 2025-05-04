import * as yup from 'yup';
export declare const gameIdParamSchema: yup.ObjectSchema<{
    gameId: string;
}, yup.AnyObject, {
    gameId: undefined;
}, "">;
export declare const createGameBodySchema: yup.ObjectSchema<{
    name: string;
    genre: string;
    releaseDate: Date;
}, yup.AnyObject, {
    name: undefined;
    genre: undefined;
    releaseDate: undefined;
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
