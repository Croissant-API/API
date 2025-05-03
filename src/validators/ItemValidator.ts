import * as yup from 'yup';

// Validator pour la création d'un item
export const createItemValidator = yup.object().shape({
    name: yup.string().required(),
    description: yup.string().optional(),
    price: yup.number().required()
});

// Validator pour la mise à jour d'un item
export const updateItemValidator = yup.object().shape({
    name: yup.string().optional(),
    description: yup.string().optional(),
    price: yup.number().optional(),
});

// Validator pour la suppression et la récupération d'un item (paramètre itemId)
export const itemIdParamValidator = yup.object().shape({
    itemId: yup.string().required(),
});