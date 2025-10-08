import * as yup from 'yup';

export const tradeItemSchema = yup.object({
  itemId: yup.string().required(),
  amount: yup.number().integer().min(1).required(),
});

export const tradeSchema = yup.object({
  id: yup.number().integer().required(),
  fromUserId: yup.string().required(),
  toUserId: yup.string().required(),
  fromUserItems: yup.array().of(tradeItemSchema).required(),
  toUserItems: yup.array().of(tradeItemSchema).required(),
  approvedFromUser: yup.boolean().required(),
  approvedToUser: yup.boolean().required(),
  status: yup.string().oneOf(['pending', 'completed', 'canceled']).required(),
});

export const tradeStatusSchema = yup.object({
  status: yup.string().oneOf(['pending', 'completed', 'canceled']).required(),
});

export const tradeApproveSchema = yup.object({
  // No body expected
});

export const tradeItemActionSchema = yup.object({
  userKey: yup.string().oneOf(['fromUserItems', 'toUserItems']).required(),
  tradeItem: tradeItemSchema.required(),
});
