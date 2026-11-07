# Model card và minh chứng AI của Muadee

## 1. Tổng quan các thành phần AI

| Thành phần | Mô hình / thuật toán | Có huấn luyện không? | Dữ liệu |
|---|---|---|---|
| Chatbot tư vấn | `qwen2.5:3b` qua Ollama (hoặc LLM tương thích OpenAI) + tìm sản phẩm TF-IDF cosine | Không fine-tune; dùng model pretrained và truy xuất catalog (RAG đơn giản) | Catalog, tồn kho, 3 đơn gần nhất của khách trong MongoDB |
| Tìm sản phẩm bằng ảnh | CLIP `clip-ViT-B-32`, easyocr, moondream | Không fine-tune; chỉ tạo index vector cho ảnh sản phẩm Muadee | Ảnh sản phẩm trong `backend/uploads` |
| Gợi ý sản phẩm (chạy thật) | Content-based, cá nhân hóa theo hoạt động/đơn hàng, bán chạy | Không cần huấn luyện (thống kê và độ tương đồng) | Dữ liệu Muadee |
| Gợi ý sản phẩm (benchmark) | Popularity, ItemKNN, BPR-MF, LightGCN | Có huấn luyện, chỉ để so sánh offline | UCI Online Retail II |
| Dự báo nhu cầu | Exponential smoothing trên doanh số theo ngày (56 ngày) | Không có tham số học; `ALPHA` chọn bằng backtest | Đơn hàng và tồn kho Muadee |

## 2. Dataset

- **Online Retail II (UCI)**: 1.067.371 dòng gốc, sau tiền xử lý còn 768.830 tương tác, 5.881 khách và 4.631 SKU (12/2009 – 12/2011). Giấy phép CC BY 4.0; cần ghi công UCI và Daqing Chen. Chi tiết: [recommender-benchmark.md](recommender-benchmark.md).
- **Dữ liệu Muadee**: sản phẩm, tồn kho và 605 đơn hàng seed (01/09/2026 – 30/10/2026). Dữ liệu này là dữ liệu mẫu, không phải giao dịch thật.

## 3. Minh chứng đánh giá

| Phần | Kết quả | File |
|---|---|---|
| Benchmark gợi ý (LightGCN tốt nhất, Recall@10 = 0.0269, HitRate@10 = 0.401; 1 seed) | metrics theo model và kịch bản | `ai-service/app/data/eval/recommender/metrics.csv`, [recommender-metrics.csv](recommender-metrics.csv) |
| Tìm sản phẩm của chatbot: 150 truy vấn (30 sản phẩm × 5 cách hỏi), Top-1 = 98,7%, Top-5 = 100% | `search_eval.csv`, `evaluation-summary.json` | thư mục này |
| Chất lượng câu trả lời chatbot (Qwen2.5 3B qua Ollama, 32 câu hỏi, CPU): hỏi còn hàng đúng 100% (12/12), hỏi giá đúng 100% (12/12), từ chối đúng món không bán 100% (8/8), trả lời tiếng Việt 100%, trung bình 16 giây/câu. Lần chạy đầu tiên từ chối đúng 75% (6/8); lỗi được sửa bằng cách loại từ đệm ("có", "không", "bán"…) khỏi câu truy vấn | `chat_eval.csv`, `chat_eval_summary.json` | thư mục này |
| Dự báo nhu cầu: backtest dự đoán 7 ngày cuối cho 30 sản phẩm. MAE: smoothing 4,99; trung bình phẳng 4,32; luôn dự đoán 0 là 5,67 | `forecast_backtest.csv` | thư mục này |

Chạy lại: `cd ai-service` rồi `python -m app.ml.eval.evaluate --output ../docs/bao-cao`.
Test tự động: `python -m pytest` (12 test, gồm dự báo).

## 4. Xung đột và giới hạn (cần trả lời trung thực)

- **Rò rỉ dữ liệu (data leakage)**: benchmark chia theo thời gian 70/10/20, mọi tương tác cùng timestamp ở cùng một phần, sản phẩm đã thấy trong train bị loại khỏi danh sách dự đoán. Test chỉ chạy với cấu hình cố định trước.
- **Lệch miền dữ liệu**: Online Retail II là nhà bán lẻ ở Anh, khác SKU và hành vi mua của Muadee. Các model collaborative chưa được train trên Muadee, và hệ thống thật không dùng LightGCN.
- **Chatbot và CLIP không fine-tune**: chỉ dùng model pretrained.
- **Đánh giá tìm kiếm có tính tự tham chiếu**: truy vấn sinh từ chính tên sản phẩm nên con số cao hơn so với câu hỏi tự nhiên của khách. Đây là mức sàn, không phải độ chính xác thực tế.
- **Chất lượng câu trả lời LLM**: chạy bằng `python -m app.ml.eval.chat_eval`. Mẫu nhỏ (32 câu), chạy 1 lần, các câu hỏi do chính nhóm viết theo mẫu cố định nên chỉ mang tính tham khảo, chưa đại diện cho câu hỏi tự do của khách. Ollama có thể quá thời gian chờ 60 giây trên CPU; khi đó hệ thống tự hạ xuống trả lời theo từ khóa (không có giá).
- **Dự báo**: dữ liệu seed gần như ổn định nên trung bình phẳng (MAE 4,32) thắng smoothing (4,99). Smoothing chỉ có lợi khi nhu cầu có xu hướng, mà dữ liệu seed chưa thể hiện điều này. Backtest chỉ có 30 sản phẩm và 1 cửa sổ. Mốc thời gian được neo vào đơn hàng mới nhất khi dữ liệu cũ hơn hôm nay.
- **Benchmark mới có 1 seed**: lệnh `--seeds 1 2 3 4 5` đã được thêm để ra mean ± std, nhưng cần file dữ liệu Online Retail II được tải về để chạy.
