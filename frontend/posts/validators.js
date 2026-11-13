// API spec 8.2 + 8.7. Shared with the development mock, never a substitute for BE validation.
export const CONDITION_LABELS = { new: 'Mới', like_new: 'Như mới', used: 'Đã qua sử dụng' };
export const STATUS_LABELS = { available: 'Còn đồ', reserved: 'Đã hẹn nhận', given: 'Đã trao' };

export function isHttpUrl(value) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); }
  catch { return false; }
}

export function validatePost(values, categories, { partial = false, allowStatus = false } = {}) {
  const errors = {};
  const check = (name) => !partial || Object.hasOwn(values, name);
  if (check('title') && (typeof values.title !== 'string' || values.title.trim().length < 5 || values.title.trim().length > 150)) errors.title = 'Tên món đồ cần từ 5 đến 150 ký tự.';
  if (check('categoryId') && (!Number.isInteger(values.categoryId) || !categories.some((category) => category.id === values.categoryId))) errors.categoryId = 'Vui lòng chọn một danh mục hợp lệ.';
  if (check('description') && (typeof values.description !== 'string' || !values.description.trim() || values.description.trim().length > 2000)) errors.description = 'Vui lòng nhập mô tả, tối đa 2000 ký tự.';
  if (check('itemCondition') && !Object.hasOwn(CONDITION_LABELS, values.itemCondition)) errors.itemCondition = 'Vui lòng chọn tình trạng của món đồ.';
  if (check('location') && (typeof values.location !== 'string' || !values.location.trim())) errors.location = 'Vui lòng nhập khu vực nhận đồ.';
  if (Object.hasOwn(values, 'imageUrl') && (typeof values.imageUrl !== 'string' || (values.imageUrl !== '' && !isHttpUrl(values.imageUrl)))) errors.imageUrl = 'Link ảnh phải bắt đầu bằng http:// hoặc https://.';
  if (allowStatus && Object.hasOwn(values, 'status') && !Object.hasOwn(STATUS_LABELS, values.status)) errors.status = 'Trạng thái bài đăng không hợp lệ.';
  return errors;
}

export function createPayload(values) {
  const payload = {
    title: values.title.trim(), categoryId: Number(values.categoryId),
    description: values.description.trim(), itemCondition: values.itemCondition,
    location: values.location.trim(),
  };
  if (values.imageUrl.trim()) payload.imageUrl = values.imageUrl.trim();
  return payload;
}

// PATCH sends only changed fields, never ownerId or client-generated timestamps.
export function patchPayload(values, original) {
  const next = { ...createPayload(values), status: values.status };
  const previous = { ...original, categoryId: original.category.id };
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== previous[key]));
}
