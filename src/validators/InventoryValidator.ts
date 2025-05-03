import * as yup from 'yup';

export const userIdParamSchema = yup.object({
    userId: yup.string().required('userId is required'),
});

export const addItemSchema = yup.object({
    itemId: yup.string().required('itemId is required'),
    amount: yup
        .number()
        .typeError('amount must be a number')
        .integer('amount must be an integer')
        .min(1, 'amount must be at least 1')
        .required('amount is required'),
});

export const removeItemSchema = yup.object({
    itemId: yup.string().required('itemId is required'),
    amount: yup
        .number()
        .typeError('amount must be a number')
        .integer('amount must be an integer')
        .min(1, 'amount must be at least 1')
        .required('amount is required'),
});

export const setItemAmountSchema = yup.object({
    itemId: yup.string().required('itemId is required'),
    amount: yup
        .number()
        .typeError('amount must be a number')
        .integer('amount must be an integer')
        .min(0, 'amount must be at least 0')
        .required('amount is required'),
});