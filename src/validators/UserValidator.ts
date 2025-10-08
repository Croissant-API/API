import * as yup from 'yup';

// Validator for creating a user
export const createUserValidator = yup.object().shape({
  userId: yup.string().required(),
  username: yup.string().required(),
  balance: yup.number().required(),
});

// Validator for updating a user
export const updateUserValidator = yup.object().shape({
  username: yup.string().optional(),
  balance: yup.number().optional(),
});

// Validator for userId param
export const userIdParamValidator = yup.object().shape({
  userId: yup.string().required(),
});
