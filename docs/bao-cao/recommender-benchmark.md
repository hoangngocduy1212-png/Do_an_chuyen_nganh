# Nghiên cứu và benchmark hệ gợi ý

## Mục tiêu

Đo lường các phương pháp implicit-feedback cho luồng mua sắm: Popularity, ItemKNN, BPR-MF và LightGCN. Module nằm trong `ai-service/app/ml/training/recommender/`; chưa nối mô hình học được vào API `/recommend`, vốn đang phục vụ TF-IDF/sản phẩm bán chạy.

## Dữ liệu

Dùng [UCI Online Retail II](https://archive.ics.uci.edu/dataset/502/online_retail%2Bii), dữ liệu giao dịch bán lẻ trực tuyến trong hai năm. Bản gốc là workbook `online_retail_II.xlsx`; tải từ trang UCI và lưu cục bộ ngoài Git. Bộ chuẩn hóa giữ khách hàng có mã, SKU, ngày giao dịch và số lượng dương; hóa đơn bắt đầu bằng `C` (hủy/hoàn trả) bị loại. Chỉ gộp các dòng cùng khách hàng/SKU tại cùng thời điểm; các lần mua lặp ở thời điểm khác nhau được giữ nguyên để tránh rò rỉ thời gian. Nhãn test là nhị phân (có mua/không mua); train giữ tần suất lặp: Popularity đếm sự kiện, ItemKNN dùng ma trận tần suất, còn BPR/LightGCN lấy mẫu cặp dương theo số lần xuất hiện.

Seed của ứng dụng tạo 600 đơn từ dữ liệu mô phỏng trong khoảng 60 ngày và chỉ 30 khách hàng; không dùng để kết luận hiệu quả nghiên cứu. Không commit workbook UCI vào Git vì tệp lớn; khi chia sẻ lại dữ liệu/kết quả cần ghi công theo giấy phép CC BY 4.0.

## Chia dữ liệu và giao thức

Sắp xếp theo thời gian toàn cục: 70% mốc thời gian đầu cho train, 10% tiếp theo cho validation, 20% cuối cho test. Tất cả sự kiện cùng timestamp nằm trong cùng partition. Validation hiện được giữ riêng để chọn siêu tham số; kết quả chuẩn của test chỉ nên chạy sau khi cố định cấu hình.

Tại đánh giá, mỗi khách hàng nhận top-K từ catalog đã xuất hiện trong train; sản phẩm đã tương tác trong train bị lọc. Chỉ thị số liệu: Recall@10, NDCG@10, HitRate@10 và catalog coverage. Báo cáo thêm phân nhóm khách hàng cold-start và item warm-start; item mới ở test không nằm trong candidate catalog của mô hình collaborative-only, nên coverage/recall của chúng phản ánh đúng giới hạn cold-item, không phải dự đoán nội dung.

## Mô hình

- **Popularity:** xếp hạng theo số tương tác trong train; baseline toàn cục, fallback cho khách hàng mới.
- **ItemKNN:** cosine giữa vector khách hàng × sản phẩm, cộng tương đồng K láng giềng sản phẩm trong lịch sử người dùng.
- **BPR-MF:** embedding user/item tối ưu pairwise Bayesian Personalized Ranking với negative sampling.
- **LightGCN:** lan truyền embedding trên đồ thị user-item hai chiều với chuẩn hóa bậc, cộng trung bình embedding các lớp và tối ưu cùng mục tiêu BPR.

## Kết quả chạy ban đầu

Chạy trên 394,965 tương tác đã chuẩn hóa: train 267,738; validation 42,341; test 84,886. Test có 2,006 người dùng có ít nhất một sản phẩm mới so với train; 595 người dùng chưa xuất hiện ở train. Có 174 SKU lạnh, tương ứng 5,299 tương tác test. BPR và LightGCN dùng 15 epoch, embedding 32 chiều; seed 42. Bảng dưới là kết quả top-10 của một lần chạy, không phải kết luận cuối.

| Mô hình | Recall@10 | NDCG@10 | HitRate@10 | Coverage |
|---|---:|---:|---:|---:|
| Popularity | 0.0202 | 0.0590 | 0.3425 | 0.0175 |
| ItemKNN | 0.0264 | 0.0659 | 0.3445 | 0.2245 |
| BPR-MF | 0.0272 | 0.0667 | 0.3654 | 0.4917 |
| LightGCN | **0.0344** | **0.0831** | **0.4347** | 0.2604 |

Trên warm-item, LightGCN cũng cao nhất (Recall@10 0.0385, NDCG@10 0.0845); trên cold-user, mọi mô hình dùng fallback Popularity và cho cùng kết quả (Recall@10 0.0327). Với cold-item, collaborative-only nhận Recall/NDCG bằng 0 vì candidate catalog chỉ chứa SKU đã có trong train. Đây là hạn chế hiện diện trong giao thức, không chứng minh một giải pháp nội dung sẽ thất bại.

## Chạy

```powershell
cd ai-service
pip install -r requirements-recommender.txt
python -m app.ml.training.recommender.prepare_online_retail --source C:\data\online_retail_II.xlsx
python -m app.ml.training.recommender.benchmark --data app/data/eval/online_retail_ii.csv --output app/data/eval/recommender --k 10 --epochs 15
```

Kết quả đầy đủ gồm `metrics.csv` và `split_summary.json` trong thư mục dữ liệu cục bộ `ai-service/app/data/eval/recommender/`; không chứa dữ liệu gốc trong Git. Kết quả trong báo cáo là một seed và một cấu hình. Trước khi đưa vào luận văn, chạy nhiều seed, báo cáo mean ± standard deviation, chọn siêu tham số chỉ trên validation, rồi đánh giá test một lần với cấu hình đã khóa. Script chưa tự động dò siêu tham số.

## Giới hạn và việc tiếp theo

Đây là benchmark ngoại tuyến, không phải kết quả thực nghiệm đã hoàn thành. Item cold-start cần baseline theo metadata (ví dụ category/popular-within-category) hoặc hybrid content model; không được diễn giải collaborative filtering là xử lý được item chưa thấy. Chưa có số liệu để khẳng định mô hình nào tốt hơn. Trước khi dùng báo cáo, cần tải dữ liệu, cài PyTorch, chạy pipeline và kiểm tra kết quả, sau đó cố định config/seed và đánh giá test một lần.
