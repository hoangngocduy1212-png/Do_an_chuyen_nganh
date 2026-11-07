# Nghiên cứu và benchmark hệ gợi ý

## Phạm vi

Phần này chuẩn hóa Online Retail II, chia dữ liệu theo thời gian, so sánh Popularity, ItemKNN, BPR-MF và LightGCN, đồng thời đánh giá khách mới và sản phẩm mới. Kết quả benchmark được lưu trong báo cáo/metrics; giao diện người mua chỉ hiển thị gợi ý sản phẩm phù hợp, không hiển thị công cụ nghiên cứu. Các mô hình collaborative bên dưới là benchmark ngoại tuyến và chưa được huấn luyện trên catalog Muadee.

## Dataset và tiền xử lý

Dùng UCI [Online Retail II](https://archive.ics.uci.edu/dataset/502/online_retail%2Bii), gồm hai sheet `Year 2009-2010` và `Year 2010-2011`, từ 01/12/2009 đến 09/12/2011. Bản workbook có 1,067,371 dòng giao dịch. Lưu bản tải về tại `ai-service/app/data/eval/source/online_retail_II.xlsx`; workbook và dữ liệu chuẩn hóa được loại khỏi Git vì kích thước lớn. Dataset thuộc giấy phép CC BY 4.0; cần ghi công UCI và Daqing Chen khi sử dụng.

Pipeline xử lý cả hai sheet. Loại dòng thiếu Customer ID, StockCode hoặc InvoiceDate; loại invoice bắt đầu bằng `C` và quantity không dương. Gộp các dòng cùng customer, SKU và timestamp, giữ các lần mua lặp ở thời điểm khác nhau. Mỗi lần mua theo thời gian là một implicit positive event; quantity được lưu trong cột `strength`, nhưng các metric top-K đánh giá nhãn mua nhị phân.

Sau tiền xử lý có **768,830 tương tác**, **5,881 khách hàng**, **4,631 SKU**, trong khoảng `2009-12-01` đến `2011-12-09`.

## Chia dữ liệu theo thời gian

Sắp xếp timestamp toàn cục; mục tiêu 70/10/20 được tính trên các mốc thời gian duy nhất, và mọi tương tác cùng timestamp luôn ở cùng partition. Vì vậy tỷ lệ số dòng thực tế có thể lệch nhẹ:

| Partition | Tỷ lệ | Số tương tác |
|---|---:|---:|
| Train | 70% | 521,708 |
| Validation | 10% | 72,763 |
| Test | 20% | 174,359 |

Validation được giữ riêng; lần benchmark này dùng cấu hình cố định trước (không dò hyperparameter trên test): top-10, embedding 32 chiều, 2 lớp LightGCN, 15 epoch và seed 42. Đây là một lần chạy, chưa phải mean ± standard deviation của nhiều seed.

## Phương pháp và metric

- **Popularity:** xếp theo số lần tương tác trong train; cũng là fallback cho khách chưa có lịch sử.
- **ItemKNN:** cosine item-item từ ma trận tương tác khách hàng × SKU; cộng điểm láng giềng từ lịch sử khách.
- **BPR-MF:** embedding khách/SKU và pairwise Bayesian Personalized Ranking với negative sampling.
- **LightGCN:** lan truyền embedding trên đồ thị hai phía khách-SKU, tối ưu BPR.
- Candidate catalog chỉ gồm SKU đã xuất hiện trong train; sản phẩm đã thấy trong train bị loại khỏi danh sách dự đoán.
- **Recall@10**, **NDCG@10**, **HitRate@10** đo chất lượng xếp hạng; **Coverage** là tỷ lệ candidate catalog được đề xuất.

## Kết quả trên tập test

Metrics đầy đủ, gồm bốn mô hình và các kịch bản, nằm trong [`recommender-metrics.csv`](recommender-metrics.csv); trang web trình bày cùng số liệu này.

| Mô hình | Recall@10 | NDCG@10 | HitRate@10 | Coverage |
|---|---:|---:|---:|---:|
| Popularity | 0.01597 | 0.05113 | 0.30548 | 0.01866 |
| ItemKNN | 0.02227 | 0.06326 | 0.36497 | 0.20170 |
| BPR-MF | 0.02218 | 0.06224 | 0.35628 | **0.54417** |
| LightGCN | **0.02691** | **0.07381** | **0.40107** | 0.32121 |

LightGCN đạt Recall, NDCG và HitRate cao nhất trong lần chạy này; BPR-MF có coverage lớn nhất. Trên warm-item, LightGCN đạt Recall@10 0.03745, NDCG@10 0.07700, HitRate@10 0.40650. Đây là kết quả của một seed và cấu hình đã nêu, không khẳng định mô hình luôn thắng trên dataset khác.

## Kịch bản cold-start

Trong test có **822 khách chưa xuất hiện trong train** và **394 SKU mới chưa xuất hiện trong train**.

| Mô hình | Kịch bản | Recall@10 | NDCG@10 | HitRate@10 |
|---|---|---:|---:|---:|
| Tất cả mô hình | Khách mới | 0.02227 | 0.07838 | 0.42579 |
| Tất cả mô hình | SKU mới chưa có trong catalog train | 0.00000 | 0.00000 | 0.00000 |

Khách mới được fallback về Popularity nên các mô hình có cùng điểm. Collaborative-only không thể gợi ý SKU hoàn toàn chưa thấy vì SKU đó không tồn tại trong candidate catalog; số 0 là giới hạn của giao thức/model này, không phải bằng chứng rằng content-based cũng thất bại. Dữ liệu trang chủ có thêm gợi ý bán chạy; trên trang chi tiết web dùng metadata nội dung để tìm sản phẩm tương tự.

## Chạy lại pipeline

```powershell
cd C:\dacn_hk7\Do_an_chuyen_nganh\ai-service
.venv\Scripts\python.exe -m pip install -r requirements-recommender.txt
.venv\Scripts\python.exe -m app.ml.training.recommender.prepare_online_retail --source app/data/eval/source/online_retail_II.xlsx --output app/data/eval/online_retail_ii.csv
.venv\Scripts\python.exe -m app.ml.training.recommender.benchmark --data app/data/eval/online_retail_ii.csv --output app/data/eval/recommender_full --k 10 --epochs 15
```

Trên giao diện người mua, recommender xuất hiện tự nhiên tại trang chủ (**Có thể bạn quan tâm**, **Bán chạy**), trang danh mục, chi tiết sản phẩm (**Sản phẩm tương tự**, **Sản phẩm bán chạy**) và giỏ hàng (**Có thể mua cùng**). Khách đã đăng nhập nhận gợi ý từ lịch sử xem, thêm giỏ và đơn hàng; khách mới nhận bán chạy tại cửa hàng đang chọn. Các bảng benchmark và cold-start chỉ nằm trong tài liệu nghiên cứu.

## Giới hạn

Dataset UCI dùng SKU/khách hàng của một nhà bán lẻ khác; không ánh xạ trực tiếp sang sản phẩm Muadee. Benchmark ngoại tuyến dùng để so sánh thuật toán; giao diện project tạo danh sách từ catalog/tồn kho Muadee, cá nhân hóa theo hoạt động khách hàng và dùng content-based/Popularity khi cần. Cần chạy nhiều seed và báo cáo mean ± standard deviation trước khi kết luận học thuật cuối cùng. Nên dùng validation để chọn siêu tham số rồi chỉ đánh giá test một lần với cấu hình khóa.
