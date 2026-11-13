// Development only. Called by the shared auth mock when USE_MOCK = true.
// The real backend owns authentication, authorization and database persistence.
import { validatePost } from './validators.js';

const STORAGE_KEY = 'mock_posts_v1';
export const MOCK_CATEGORIES = [
  { id: 1, name: 'Sách vở' }, { id: 2, name: 'Quần áo' },
  { id: 3, name: 'Đồ gia dụng' }, { id: 4, name: 'Đồ điện tử' }, { id: 5, name: 'Đồ dùng học tập' },
];
const image = (name) => new URL(`./assets/${name}.jpg`, import.meta.url).href;
const seeds = [
  ['Bộ sách cho những ngày chậm lại', 1, 'books', 'Cầu Giấy, Hà Nội', 'like_new', 'available', 1, 'Mình có một số cuốn sách đã đọc xong, muốn tặng lại cho người yêu sách. Sách được giữ gìn cẩn thận, không rách hay mất trang. Bạn có thể nhận vào buổi chiều nhé.'],
  ['Áo khoác da, còn rất mới', 2, 'jacket', 'Đống Đa, Hà Nội', 'used', 'available', 2, 'Áo size M, mình ít mặc nên còn tốt. Đã vệ sinh sạch, khóa kéo hoạt động bình thường. Mong chiếc áo sẽ có thêm những chuyến đi mới.'],
  ['Chiếc ghế cho góc đọc sách', 3, 'chair', 'Hai Bà Trưng, Hà Nội', 'used', 'reserved', 1, 'Ghế chắc chắn, ngồi thoải mái. Mình sắp chuyển nhà nên tặng lại. Chân ghế có một vài vết xước nhỏ, không ảnh hưởng đến sử dụng.'],
  ['Bàn làm việc gọn xinh', 3, 'desk', 'Thanh Xuân, Hà Nội', 'like_new', 'available', 4, 'Bàn gỗ dùng cho góc học tập hoặc làm việc nhỏ. Mặt bàn sạch và bằng phẳng. Người nhận vui lòng tự sắp xếp vận chuyển.'],
  ['Chuột máy tính không dây', 4, 'mouse', 'Cầu Giấy, Hà Nội', 'like_new', 'available', 1, 'Chuột còn dùng tốt, tặng kèm đầu thu USB. Mình đổi sang thiết bị khác nên không dùng nữa.'],
  ['Xe đạp cho những chuyến đi gần', 3, 'bicycle', 'Tây Hồ, Hà Nội', 'used', 'given', 2, 'Xe đã được trao cho một người bạn trong cộng đồng. Cảm ơn mọi người đã quan tâm.'],
  ['Bộ dụng cụ chăm cây tại nhà', 3, 'plant', 'Hoàng Mai, Hà Nội', 'used', 'available', 1, 'Mình có dư một bộ dụng cụ chăm cây nhỏ, vẫn còn dùng tốt. Mong tặng lại cho bạn thích chăm sóc góc vườn của mình.'],
  ['Đèn bàn cho góc nhỏ ấm áp', 3, 'lamp', 'Long Biên, Hà Nội', 'used', 'available', 4, 'Đèn còn sáng tốt, dây điện nguyên vẹn. Đã lau sạch và sẵn sàng tặng lại.'],
  ['Sách tham khảo dành cho sinh viên', 1, 'books', 'Hà Đông, Hà Nội', 'used', 'available', 2, 'Một vài cuốn sách tham khảo còn tốt, có đánh dấu một số đoạn bằng bút chì.'],
  ['Áo khoác đồng hành ngày se lạnh', 2, 'jacket', 'Nam Từ Liêm, Hà Nội', 'used', 'reserved', 1, 'Áo đã giặt sạch, size M. Có thể nhận vào cuối tuần.'],
  ['Ghế học tập còn chắc chắn', 5, 'chair', 'Bắc Từ Liêm, Hà Nội', 'used', 'available', 4, 'Ghế phù hợp cho góc học tập nhỏ, chân ghế chắc chắn.'],
  ['Bàn gỗ dành cho phòng nhỏ', 5, 'desk', 'Đống Đa, Hà Nội', 'like_new', 'available', 1, 'Bàn gỗ còn sạch đẹp, nhường lại để có thêm không gian trong phòng.'],
  ['Đèn đọc sách còn dùng tốt', 3, 'lamp', 'Hai Bà Trưng, Hà Nội', 'used', 'available', 2, 'Đèn gọn nhẹ, dễ đặt trên bàn. Mong tặng lại cho bạn nào cần.'],
  ['Dụng cụ cho góc vườn nhỏ', 3, 'plant', 'Thanh Xuân, Hà Nội', 'used', 'available', 1, 'Xẻng nhỏ và dụng cụ làm vườn, đã vệ sinh sạch và sẵn sàng tặng lại.'],
];

function loadPosts() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(data)) return data;
  } catch { /* Seed only when storage has not been initialized or is corrupt. */ }
  const owners = { 1: 'Nguyễn Văn A', 2: 'Trần Thị B', 4: 'Lê Hoàng C' };
  const posts = seeds.map(([title, categoryId, photo, location, itemCondition, status, ownerId, description], index) => {
    const createdAt = new Date(Date.UTC(2026, 10, 12, 12) - index * 3600000).toISOString();
    return { id: index + 1, title, description, itemCondition, location, imageUrl: image(photo), status,
      category: { ...MOCK_CATEGORIES.find((category) => category.id === categoryId) },
      owner: { id: ownerId, fullName: owners[ownerId] }, createdAt, updatedAt: createdAt };
  });
  savePosts(posts);
  return posts;
}
function savePosts(posts) { localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)); }
function json(status, data) { return new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }
const failure = (status, message) => json(status, { message });
const fields = ['title', 'categoryId', 'description', 'itemCondition', 'location', 'imageUrl'];

export function mockPostRequest(path, { method = 'GET', body, user = null } = {}) {
  const url = new URL(path, 'http://mock.local');
  const pathname = url.pathname;
  if (method === 'GET' && pathname === '/categories') return json(200, { data: MOCK_CATEGORIES });
  if (pathname !== '/posts' && !/^\/posts\/\d+$/.test(pathname)) return failure(404, 'Không tìm thấy API.');
  const posts = loadPosts();
  const id = pathname === '/posts' ? null : Number(pathname.split('/').at(-1));
  if (method === 'GET' && id === null) {
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('limit') || 12);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) return json(400, { message: 'Phân trang không hợp lệ', errors: { pagination: 'page ≥ 1; limit từ 1 đến 50.' } });
    const sorted = [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    const data = sorted.slice((page - 1) * limit, page * limit).map(({ id: postId, title, imageUrl, location, status, category, createdAt }) => ({ id: postId, title, imageUrl, location, status, category, createdAt }));
    return json(200, { data, pagination: { page, limit, total: posts.length, totalPages: Math.ceil(posts.length / limit) } });
  }
  const post = posts.find((entry) => entry.id === id);
  if (method === 'GET') return post ? json(200, { post }) : failure(404, 'Bài đăng không còn tồn tại.');
  if (!user) return failure(401, 'Bạn cần đăng nhập để tiếp tục.');
  if (method === 'POST' && id !== null) return failure(404, 'Không tìm thấy API.');
  if (['PATCH', 'DELETE'].includes(method)) {
    if (!post) return failure(404, 'Bài đăng không còn tồn tại.');
    if (post.owner.id !== user.id) return failure(403, 'Bạn chỉ được sửa hoặc xóa bài đăng của mình.');
  }
  if (method === 'DELETE') { savePosts(posts.filter((entry) => entry.id !== id)); return json(204); }
  if (!['POST', 'PATCH'].includes(method)) return failure(404, 'Không tìm thấy API.');
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { message: 'Dữ liệu không hợp lệ', errors: { body: 'Request phải là một đối tượng JSON.' } });
  const allowed = method === 'PATCH' ? [...fields, 'status'] : fields;
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  const errors = validatePost(body, MOCK_CATEGORIES, { partial: method === 'PATCH', allowStatus: method === 'PATCH' });
  for (const key of unknown) errors[key] = `Trường ${key} không nằm trong API Spec.`;
  if (Object.keys(errors).length) return json(400, { message: 'Dữ liệu không hợp lệ', errors });
  const now = new Date().toISOString();
  const changed = {};
  for (const key of allowed) {
    if (!Object.hasOwn(body, key)) continue;
    if (key === 'categoryId') changed.category = { ...MOCK_CATEGORIES.find((category) => category.id === body.categoryId) };
    else changed[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
  }
  if (method === 'POST') {
    const created = { id: Math.max(0, ...posts.map((entry) => entry.id)) + 1, ...changed, imageUrl: changed.imageUrl || null,
      status: 'available', owner: { id: user.id, fullName: user.fullName }, createdAt: now, updatedAt: now };
    savePosts([...posts, created]);
    return json(201, { post: created });
  }
  const updated = { ...post, ...changed, updatedAt: now };
  savePosts(posts.map((entry) => entry.id === id ? updated : entry));
  return json(200, { post: updated });
}
