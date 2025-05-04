import * as yup from 'yup';

export const userIdParamSchema = yup.object({
    userId: yup.string().required('userId is required'),
});