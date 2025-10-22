import * as yup from 'yup';
export declare const createUserValidator: yup.ObjectSchema<{
    userId: string;
    username: string;
    balance: number;
}, yup.AnyObject, {
    userId: undefined;
    username: undefined;
    balance: undefined;
}, "">;
export declare const updateUserValidator: yup.ObjectSchema<{
    username: string | undefined;
    balance: number | undefined;
}, yup.AnyObject, {
    username: undefined;
    balance: undefined;
}, "">;
export declare const userIdParamValidator: yup.ObjectSchema<{
    userId: string;
}, yup.AnyObject, {
    userId: undefined;
}, "">;
