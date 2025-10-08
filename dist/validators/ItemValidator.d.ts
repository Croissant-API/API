import * as yup from 'yup';
export declare const createItemValidator: yup.ObjectSchema<{
    name: string;
    description: string | undefined;
    price: number;
}, yup.AnyObject, {
    name: undefined;
    description: undefined;
    price: undefined;
}, "">;
export declare const updateItemValidator: yup.ObjectSchema<{
    name: string | undefined;
    description: string | undefined;
    price: number | undefined;
}, yup.AnyObject, {
    name: undefined;
    description: undefined;
    price: undefined;
}, "">;
export declare const itemIdParamValidator: yup.ObjectSchema<{
    itemId: string;
}, yup.AnyObject, {
    itemId: undefined;
}, "">;

