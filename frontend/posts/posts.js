import { renderHeader } from '../js/components/header.js';
import { getMe } from '../js/api/auth.api.js';
import { getToken, saveUser, clearAuth } from '../js/utils/storage.js';
import { ROUTES } from '../js/config.js';
import { clearErrors, clearFieldError, focusFirstError, getFormValues, setFieldError, setFormAlert, setLoading, showErrors } from '../js/utils/form.js';
import { getCategories, listPosts, getPost, createPost, updatePost, deletePost } from './posts.api.js';
import { CONDITION_LABELS, STATUS_LABELS, createPayload, patchPayload, isHttpUrl, validatePost } from './validators.js';

const $ = (id) => document.getElementById(id);
const initialPage = Number(new URLSearchParams(location.search).get('page') || 1);
const state = {
  page: Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1,
  pagination: null, categories: null, categoriesPromise: null, user: null, authError: null,
  listTicket: 0, dialogTicket: 0, currentPost: null, saving: false, deleting: false,
  deleteTarget: null, returnFocus: null,
};
let toastTimer;
let imageTimer;
const postDialog = $('post-dialog');
const deleteDialog = $('delete-dialog');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderPageHeader() {
  renderHeader();
  const brand = $('site-header').querySelector('.brand');
  const mark = element('img', 'brand-mark');
  mark.src = new URL('./assets/favicon.svg', import.meta.url).href;
  mark.alt = '';
  mark.setAttribute('aria-hidden', 'true');
  brand.prepend(mark);
  const caption = element('span', 'header-caption', 'Trao đồ cũ · Gửi điều hay');
  brand.after(caption);
  const createButton = element('button', 'btn btn-primary create-post-button', '+  Đăng đồ');
  createButton.type = 'button';
  createButton.addEventListener('click', () => openEditor());
  $('site-header').querySelector('.nav').append(createButton);
}

async function syncUser() {
  state.user = null;
  state.authError = null;
  if (!getToken()) { renderPageHeader(); return null; }
  try {
    const { user } = await getMe();
    if (!user || !Number.isInteger(user.id)) throw new Error('Thông tin tài khoản không hợp lệ.');
    state.user = user;
    saveUser(user);
    return user;
  } catch (error) {
    if (error.status === 401) clearAuth();
    else state.authError = error;
    return null;
  } finally { renderPageHeader(); }
}

function loginForAction(expired = false) {
  if (expired) clearAuth();
  const next = new URL(location.href);
  if (!state.currentPost) next.searchParams.set('compose', '1');
  const query = new URLSearchParams({ next: next.pathname + next.search + next.hash });
  if (expired) query.set('expired', '1');
  location.assign(`${ROUTES.login}?${query}`);
}

async function loadCategories() {
  if (state.categories) return state.categories;
  if (!state.categoriesPromise) {
    state.categoriesPromise = getCategories().then(({ data }) => {
      if (!Array.isArray(data) || data.some((entry) => !Number.isInteger(entry.id) || typeof entry.name !== 'string')) throw new Error('Danh mục trả về chưa đúng định dạng API.');
      state.categories = data;
      return data;
    }).finally(() => { state.categoriesPromise = null; });
  }
  return state.categoriesPromise;
}

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = `✓  ${message}`;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
}

function listState(title, description, action, callback) {
  $('post-grid').replaceChildren();
  $('post-grid').hidden = true;
  $('pagination').hidden = true;
  $('list-state').hidden = false;
  $('state-title').textContent = title;
  $('state-description').textContent = description;
  $('state-action').hidden = !action;
  $('state-action').textContent = action || '';
  $('state-action').onclick = callback || null;
}

function renderSkeleton() {
  $('list-state').hidden = true;
  $('post-grid').hidden = false;
  $('post-grid').setAttribute('aria-busy', 'true');
  $('pagination').hidden = true;
  const cards = Array.from({ length: 6 }, () => {
    const card = element('div', 'post-card skeleton');
    card.setAttribute('aria-hidden', 'true');
    card.append(element('div', 'card-photo'));
    const copy = element('div', 'card-copy');
    copy.append(element('div', 'skeleton-line short'), element('div', 'skeleton-line'), element('div', 'skeleton-line short'));
    card.append(copy);
    return card;
  });
  $('post-grid').replaceChildren(...cards);
}

function attachImage(image, fallback, url, title) {
  image.alt = title;
  const showFallback = () => { image.hidden = true; fallback.hidden = false; };
  if (typeof url !== 'string' || !isHttpUrl(url)) { showFallback(); return; }
  image.referrerPolicy = 'no-referrer';
  image.addEventListener('error', showFallback, { once: true });
  image.src = url;
}

function setStatus(badge, status) {
  badge.className = 'status-badge';
  if (Object.hasOwn(STATUS_LABELS, status)) badge.classList.add(`status-${status}`);
  badge.textContent = STATUS_LABELS[status] || 'Chưa rõ trạng thái';
}

function renderCards(posts) {
  const cards = posts.map((post) => {
    const card = $('post-card-template').content.firstElementChild.cloneNode(true);
    const link = card.querySelector('.card-link');
    link.href = `#post=${encodeURIComponent(post.id)}`;
    link.setAttribute('aria-label', `Xem ${post.title}`);
    attachImage(card.querySelector('img'), card.querySelector('.photo-fallback'), post.imageUrl, post.title);
    setStatus(card.querySelector('.status-badge'), post.status);
    card.querySelector('.card-category').textContent = post.category?.name || 'Chưa phân loại';
    card.querySelector('h3').textContent = post.title;
    card.querySelector('.card-location span').textContent = post.location;
    return card;
  });
  $('post-grid').replaceChildren(...cards);
}

async function loadList(page = state.page) {
  const ticket = ++state.listTicket;
  state.page = page;
  renderSkeleton();
  $('post-count').hidden = true;
  try {
    const result = await listPosts({ page, limit: 12 });
    if (ticket !== state.listTicket) return;
    const { data, pagination } = result || {};
    if (!Array.isArray(data) || !pagination || !Number.isInteger(pagination.total) || !Number.isInteger(pagination.totalPages) || !Number.isInteger(pagination.page) || !Number.isInteger(pagination.limit)) throw new Error('Danh sách trả về chưa đúng định dạng API.');
    state.pagination = pagination;
    state.page = pagination.page;
    const lastPage = Math.max(1, pagination.totalPages);
    if (page > lastPage) return loadList(lastPage);
    $('post-count').textContent = pagination.total;
    $('post-count').hidden = false;
    if (!data.length) {
      listState('Chưa có món đồ nào được chia sẻ', 'Một món đồ nhỏ cũng có thể mang đến niềm vui lớn. Hãy là người bắt đầu câu chuyện sẻ chia.', 'Chia sẻ món đồ đầu tiên ↗', () => openEditor());
      return;
    }
    renderCards(data);
    $('pagination').hidden = pagination.totalPages <= 1;
    $('previous-page').disabled = pagination.page <= 1;
    $('next-page').disabled = pagination.page >= pagination.totalPages;
    $('page-summary').textContent = `Trang ${pagination.page} / ${pagination.totalPages}`;
  } catch (error) {
    if (ticket !== state.listTicket) return;
    $('post-count').hidden = true;
    listState('Chưa tải được danh sách đồ', error.message || 'Vui lòng kiểm tra kết nối và thử lại.', 'Thử lại', () => loadList(page));
  } finally {
    if (ticket === state.listTicket) $('post-grid').setAttribute('aria-busy', 'false');
  }
}

async function changePage(offset) {
  const nextPage = state.page + offset;
  if (!state.pagination || nextPage < 1 || nextPage > state.pagination.totalPages) return;
  const url = new URL(location.href);
  if (nextPage === 1) url.searchParams.delete('page'); else url.searchParams.set('page', nextPage);
  history.replaceState(null, '', url);
  await loadList(nextPage);
  $('posts').focus({ preventScroll: true });
  $('posts').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

function openMainDialog() {
  if (!postDialog.open) {
    state.returnFocus = document.activeElement;
    postDialog.showModal();
  }
  postDialog.scrollTop = 0;
}

function dialogMessage(title, message, retry) {
  const wrap = element('div', 'dialog-message');
  const heading = element('h2', '', title);
  heading.id = 'dialog-title';
  wrap.append(heading, element('p', '', message));
  if (retry) {
    const button = element('button', 'btn btn-primary', 'Thử lại');
    button.type = 'button';
    button.addEventListener('click', retry);
    wrap.append(button);
  }
  $('dialog-content').replaceChildren(wrap);
  openMainDialog();
}

function closeMainDialog() {
  if (state.saving || state.deleting || deleteDialog.open) return;
  postDialog.close();
}

postDialog.addEventListener('close', () => {
  ++state.dialogTicket;
  clearTimeout(imageTimer);
  state.currentPost = null;
  const url = new URL(location.href);
  if (/^#post=/.test(url.hash)) url.hash = '';
  url.searchParams.delete('compose');
  history.replaceState(null, '', url);
  const target = state.returnFocus?.isConnected ? state.returnFocus : $('site-header').querySelector('.create-post-button');
  target?.focus({ preventScroll: true });
});
postDialog.addEventListener('cancel', (event) => { if (state.saving || state.deleting || deleteDialog.open) event.preventDefault(); });
postDialog.addEventListener('click', (event) => {
  if (event.target !== postDialog) return;
  const box = postDialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeMainDialog();
});
$('close-dialog').addEventListener('click', closeMainDialog);

function renderDetail(post) {
  state.currentPost = post;
  const layout = element('div', 'detail-layout');
  const photo = element('div', 'detail-photo');
  const image = element('img');
  const fallback = element('span', 'photo-fallback', '↻');
  fallback.hidden = true;
  photo.append(image, fallback);
  attachImage(image, fallback, post.imageUrl, post.title);
  const copy = element('div', 'detail-copy');
  const title = element('h2', '', post.title);
  title.id = 'dialog-title';
  title.tabIndex = -1;
  const status = element('span');
  setStatus(status, post.status);
  copy.append(element('p', 'eyebrow', post.category?.name?.toLocaleUpperCase('vi-VN') || 'ĐỒ ĐƯỢC CHIA SẺ'), title, status, element('p', 'detail-description', post.description));
  const facts = element('dl', 'detail-facts');
  const created = new Date(post.createdAt);
  const entries = [['Tình trạng', CONDITION_LABELS[post.itemCondition] || 'Chưa cập nhật'], ['Khu vực', post.location], ['Ngày đăng', Number.isNaN(created.getTime()) ? 'Chưa cập nhật' : created.toLocaleDateString('vi-VN')]];
  for (const [label, value] of entries) {
    const row = element('div');
    row.append(element('dt', '', label), element('dd', '', value));
    facts.append(row);
  }
  const owner = element('div', 'owner-info');
  const ownerName = post.owner?.fullName || 'Người chia sẻ';
  const initials = ownerName.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi-VN');
  const ownerCopy = element('div');
  ownerCopy.append(element('small', '', 'ĐƯỢC CHIA SẺ BỞI'), element('p', '', ownerName));
  owner.append(element('span', 'owner-avatar', initials), ownerCopy);
  copy.append(facts, owner);
  // The list API intentionally has no owner. Permissions use detail + verified /users/me.
  if (getToken() && state.user && post.owner?.id === state.user.id) {
    const actions = element('div', 'detail-actions');
    const edit = element('button', 'btn btn-primary', 'Sửa bài đăng');
    const remove = element('button', 'btn btn-danger', 'Xóa bài');
    edit.type = remove.type = 'button';
    edit.addEventListener('click', () => openEditor(post));
    remove.addEventListener('click', () => askDelete(post));
    actions.append(edit, remove);
    copy.append(actions);
  }
  copy.append(element('p', 'detail-footnote', 'Một món đồ được trao tặng, thêm một câu chuyện được tiếp nối.'));
  layout.append(photo, copy);
  $('dialog-content').replaceChildren(layout);
  openMainDialog();
  title.focus({ preventScroll: true });
}

async function openDetail(id) {
  const ticket = ++state.dialogTicket;
  state.currentPost = null;
  dialogMessage('Đang mở câu chuyện của món đồ…', 'Vui lòng chờ trong giây lát.');
  try {
    const [{ post }] = await Promise.all([getPost(id), state.authPromise]);
    if (ticket !== state.dialogTicket) return;
    if (!post?.id || !post.owner || !post.category) throw new Error('Chi tiết trả về chưa đúng định dạng API.');
    renderDetail(post);
  } catch (error) {
    if (ticket !== state.dialogTicket) return;
    dialogMessage(error.status === 404 ? 'Bài đăng không còn ở đây' : 'Chưa tải được bài đăng', error.message, error.status === 404 ? null : () => openDetail(id));
  }
}

function updateImagePreview(input) {
  clearTimeout(imageTimer);
  imageTimer = setTimeout(() => {
    const preview = $('image-preview');
    if (!preview || !input.isConnected) return;
    const url = input.value.trim();
    preview.hidden = !isHttpUrl(url);
    if (preview.hidden) return;
    const image = preview.querySelector('img');
    const label = preview.querySelector('span');
    image.hidden = false;
    label.textContent = 'Ảnh xem trước';
    image.onload = () => { image.hidden = false; label.textContent = 'Ảnh xem trước'; };
    image.onerror = () => { image.hidden = true; label.textContent = 'Chưa tải được ảnh. Vui lòng kiểm tra đường dẫn.'; };
    image.referrerPolicy = 'no-referrer';
    image.src = url;
  }, 300);
}

async function openEditor(original = null) {
  if (state.saving || state.deleting) return;
  state.currentPost = original;
  if (!getToken()) { loginForAction(); return; }
  const ticket = ++state.dialogTicket;
  dialogMessage('Đang chuẩn bị bài đăng…', 'Vui lòng chờ trong giây lát.');
  try {
    let user = await state.authPromise;
    if (!user && getToken()) user = await syncUser();
    if (ticket !== state.dialogTicket) return;
    if (!user) { if (state.authError) throw state.authError; loginForAction(true); return; }
    if (original && original.owner.id !== user.id) throw new Error('Bạn chỉ có thể sửa bài đăng của mình.');
    const categories = await loadCategories();
    if (ticket !== state.dialogTicket) return;
    if (!categories.length) throw new Error('Chưa có danh mục để đăng đồ. Vui lòng thử lại sau.');
    $('dialog-content').replaceChildren($('post-form-template').content.cloneNode(true));
    $('dialog-title').textContent = original ? 'Chỉnh sửa bài đăng' : 'Chia sẻ một món đồ';
    $('editor-kicker').textContent = original ? 'TIẾP NỐI CÂU CHUYỆN SẺ CHIA' : 'GỬI ĐI MỘT NIỀM VUI';
    $('save-post').textContent = original ? 'Lưu thay đổi ↗' : 'Đăng bài chia sẻ ↗';
    const form = $('post-form');
    for (const category of categories) form.elements.categoryId.add(new Option(category.name, String(category.id)));
    if (original) {
      for (const name of ['title', 'description', 'itemCondition', 'location', 'imageUrl', 'status']) form.elements[name].value = original[name] ?? '';
      form.elements.categoryId.value = String(original.category.id);
      $('status-field').hidden = false;
      $('image-help').textContent = 'Dán link mới để đổi ảnh. Để trống sẽ giữ ảnh hiện tại.';
    }
    const updateCount = () => { $('description-count').textContent = `${form.elements.description.value.length} / 2000`; };
    updateCount();
    form.elements.description.addEventListener('input', updateCount);
    form.elements.imageUrl.addEventListener('input', () => updateImagePreview(form.elements.imageUrl));
    if (form.elements.imageUrl.value) updateImagePreview(form.elements.imageUrl);
    form.addEventListener('input', (event) => { if (event.target.name) clearFieldError(form, event.target.name); });
    form.addEventListener('change', (event) => { if (event.target.name) clearFieldError(form, event.target.name); });
    form.addEventListener('focusout', (event) => {
      const name = event.target.name;
      if (!name) return;
      const values = getFormValues(form);
      const payload = { ...createPayload(values), ...(original ? { status: values.status } : {}) };
      const errors = validatePost(payload, categories, { allowStatus: Boolean(original) });
      setFieldError(form, name, errors[name]);
    });
    form.addEventListener('submit', (event) => submitPost(event, original));
    $('cancel-editor').addEventListener('click', () => { if (original) renderDetail(original); else closeMainDialog(); });
    openMainDialog();
    form.elements.title.focus({ preventScroll: true });
  } catch (error) {
    if (ticket !== state.dialogTicket) return;
    if (error.status === 401) { loginForAction(true); return; }
    dialogMessage('Chưa thể mở form đăng đồ', error.message, () => openEditor(original));
  }
}

async function submitPost(event, original) {
  event.preventDefault();
  if (state.saving) return;
  const form = event.currentTarget;
  clearErrors(form);
  const values = getFormValues(form);
  const payload = original ? patchPayload(values, original) : createPayload(values);
  const errors = validatePost(payload, state.categories, { partial: Boolean(original), allowStatus: Boolean(original) });
  if (Object.keys(errors).length) { showErrors(form, errors); focusFirstError(form); return; }
  if (original && !Object.keys(payload).length) { setFormAlert(form, 'Bạn chưa thay đổi thông tin nào.', 'info'); return; }
  if (!getToken()) { loginForAction(true); return; }
  state.saving = true;
  setLoading($('save-post'), true, 'Đang lưu…');
  for (const control of form.elements) control.disabled = true;
  $('close-dialog').disabled = true;
  try {
    const result = original ? await updatePost(original.id, payload) : await createPost(payload);
    if (!result?.post?.id) throw new Error('Máy chủ chưa trả thông tin bài đăng. Hãy tải lại danh sách trước khi thử tiếp.');
    state.saving = false;
    $('close-dialog').disabled = false;
    if (original) renderDetail(result.post); else closeMainDialog();
    if (!original) {
      const url = new URL(location.href);
      url.searchParams.delete('compose');
      url.searchParams.delete('page');
      history.replaceState(null, '', url);
    }
    await loadList(original ? state.page : 1);
    toast(original ? 'Đã lưu thay đổi bài đăng.' : 'Đã đăng bài. Cảm ơn bạn đã sẻ chia!');
  } catch (error) {
    if (error.status === 401) { loginForAction(true); return; }
    if (error.status === 400 && error.errors) {
      const unmatched = showErrors(form, error.errors);
      setFormAlert(form, unmatched.length ? unmatched.join(' ') : error.message);
    } else setFormAlert(form, error.message || 'Chưa lưu được bài đăng. Vui lòng thử lại.');
  } finally {
    state.saving = false;
    $('close-dialog').disabled = false;
    if (form.isConnected) {
      for (const control of form.elements) control.disabled = false;
      setLoading($('save-post'), false);
      focusFirstError(form);
    }
  }
}

function askDelete(post) {
  if (state.deleting || state.saving) return;
  if (!getToken()) { loginForAction(true); return; }
  if (!state.user || state.user.id !== post.owner.id) return;
  state.deleteTarget = post;
  $('delete-description').textContent = `“${post.title}”`;
  $('delete-error').hidden = true;
  deleteDialog.showModal();
}
$('cancel-delete').addEventListener('click', () => { if (!state.deleting) deleteDialog.close(); });
deleteDialog.addEventListener('cancel', (event) => { if (state.deleting) event.preventDefault(); });
$('confirm-delete').addEventListener('click', async () => {
  if (state.deleting || !state.deleteTarget) return;
  const id = state.deleteTarget.id;
  state.deleting = true;
  $('delete-error').hidden = true;
  $('cancel-delete').disabled = true;
  setLoading($('confirm-delete'), true, 'Đang xóa…');
  try {
    await deletePost(id); // Spec: 204, no response body.
    state.deleting = false;
    deleteDialog.close();
    closeMainDialog();
    await loadList();
    toast('Đã xóa bài đăng.');
  } catch (error) {
    if (error.status === 401) { loginForAction(true); return; }
    $('delete-error').textContent = error.message || 'Chưa xóa được bài đăng. Vui lòng thử lại.';
    $('delete-error').hidden = false;
  } finally {
    state.deleting = false;
    $('cancel-delete').disabled = false;
    setLoading($('confirm-delete'), false);
  }
});

function handleRoute() {
  const match = location.hash.match(/^#post=(\d+)$/);
  if (match) openDetail(Number(match[1]));
  else if (postDialog.open && !state.saving && !state.deleting) closeMainDialog();
}
$('previous-page').addEventListener('click', () => changePage(-1));
$('next-page').addEventListener('click', () => changePage(1));
window.addEventListener('hashchange', handleRoute);

renderPageHeader();
state.authPromise = syncUser();
loadList();
if (new URLSearchParams(location.search).get('compose') === '1') openEditor();
else handleRoute();
