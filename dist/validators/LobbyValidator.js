import * as yup from 'yup';
export const lobbyIdParamSchema = yup.object({
    lobbyId: yup.string().trim().required('lobbyId is required'),
});
export const userIdParamSchema = yup.object({
    userId: yup.string().trim().required('userId is required'),
});
