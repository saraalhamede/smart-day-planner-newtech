# Smart Day Planner 📅
### Full-Stack Task Management & Daily Planning Web Application

## 1. Project Overview — نبذة عن المشروع

**Smart Day Planner** هو تطبيق ويب متكامل (Full-Stack Web Application) يهدف إلى مساعدة المستخدمين على تنظيم مهامهم اليومية، وإدارة أوقاتهم، ومتابعة تقدمهم بطريقة بسيطة وواضحة.

يتيح النظام للمستخدم إنشاء حساب شخصي، إضافة المهام وتحديد أولوياتها ومواعيدها، ثم متابعة تنفيذها من خلال مخطط يومي (Daily Planner)، وتقويم شهري (Calendar)، ولوحة إحصائية (Dashboard).

تم تطوير المشروع ضمن دورة **Full Stack Development – NewTech** بهدف تطبيق المفاهيم العملية في تطوير واجهات المستخدم، بناء REST APIs، إدارة قواعد البيانات، المصادقة، وربط طبقات النظام ببعضها.

## 2. Target Audience — الفئة المستهدفة

يستهدف التطبيق الأشخاص الذين يحتاجون إلى تنظيم مهامهم ومتابعة إنجازاتهم، مثل:

- **الطلاب:** تنظيم الدراسة والواجبات والمشاريع.
- **الموظفين:** متابعة المهام والاجتماعات والأعمال اليومية.
- **العاملين بشكل مستقل (Freelancers):** إدارة المهام والمواعيد.
- **المستخدمين بشكل عام:** تنظيم الأنشطة الشخصية وإدارة الوقت.

## 3. Main Features — الوظائف الأساسية

**Authentication & User Accounts**
- إنشاء حساب جديد وتسجيل الدخول والخروج.
- إدارة الجلسات واستعادتها بعد تحديث الصفحة.
- حفظ مهام كل مستخدم بشكل مستقل.

**Task Management (CRUD)**
- إضافة المهام وعرضها وتعديلها وحذفها.
- تحديد عنوان المهمة ووصفها وتاريخها.
- تحديد الأولوية: Low / Medium / High.
- إضافة وقت بداية ونهاية اختياريين.
- التحقق من المدخلات ومنع تداخل أوقات المهام.

**Daily Planner**
- اختيار اليوم وعرض مهامه.
- تقسيم المهام إلى Waiting وIn Progress وCompleted.
- بدء المهمة وإكمالها يدويًا.
- عرض المهام ذات الأوقات المحددة في Timeline مرتبة زمنيًا.

**Monthly Calendar**
- عرض المهام ضمن تقويم شهري.
- التنقل بين الأشهر والسنوات.
- عرض عدد المهام لكل يوم.
- الانتقال مباشرة من التقويم إلى المخطط اليومي.

**Dashboard**
- عرض إجمالي المهام.
- عرض المهام المكتملة وقيد التنفيذ والمنتظرة.
- حساب نسبة الإنجاز وعرض Progress Bar.

**Data Persistence & Security**
- حفظ المستخدمين والمهام والجلسات في MySQL.
- مصادقة قائمة على Sessions وHttpOnly Cookies.
- تخزين كلمات المرور باستخدام `scrypt` مع Salt.
- تقييد الوصول إلى المهام بحسب المستخدم المصادق.

**Profile Settings**
- صفحة Settings مستقلة لعرض الحساب والأحرف الأولى للاسم بدل صورة شخصية.
- تعديل الاسم والبريد، وتغيير كلمة المرور بعد التحقق من كلمة المرور الحالية.
- تحديث بيانات المستخدم في الواجهة مباشرة، واستعادة صفحة Settings عند Refresh.

## 4. Technologies Used — التقنيات المستخدمة

| Layer | Technologies |
|---|---|
| Frontend | React, JavaScript, CSS |
| Frontend Build Tool | Vite |
| Backend | Node.js, Express.js |
| Database | MySQL, InnoDB |
| Database Driver | mysql2 |
| Authentication | express-session, express-mysql-session |
| Testing | Node.js Test Runner, Supertest |
| Version Control | Git & GitHub |

## 5. System Architecture — هيكلية النظام

يعتمد المشروع على معمارية تتكون من ثلاث طبقات رئيسية:

**1. Frontend — React**

مسؤول عن عرض الصفحات، استقبال مدخلات المستخدم، إدارة حالة الواجهة، وإرسال طلبات HTTP إلى الخادم.

**2. Backend — Node.js & Express**

مسؤول عن تنفيذ REST APIs، التحقق من بيانات المستخدم، إدارة الجلسات والصلاحيات، وتنفيذ قواعد العمل الخاصة بالمهام.

**3. Database — MySQL**

مسؤولة عن حفظ بيانات المستخدمين والمهام والجلسات، واسترجاعها عند الحاجة.

**Data Flow:**

`React Frontend → Express REST API → MySQL Database`

بعد تنفيذ العملية، يعيد Backend استجابة إلى React تتضمن البيانات المطلوبة أو نتيجة العملية.

### Project Structure

- `client/` — تطبيق React ومكونات الواجهة، بما فيها Tasks وDaily Planner وCalendar وDashboard.
- `server/` — خادم Express ومسارات API والمصادقة والتحقق والتعامل مع قاعدة البيانات.
- `server/db/` — ملفات إعداد قاعدة البيانات وترحيلاتها.
- `docs/` — تقارير التطوير والفحص والتوثيق.
- `.env.example` — قالب إعداد متغيرات البيئة.
- `README.md` — تعليمات المشروع والتشغيل.

### Database Structure

تستخدم قاعدة البيانات `smart_day_planner_newtech` ثلاثة جداول رئيسية:

- `users`: معلومات المستخدمين وبيانات المصادقة.
- `tasks`: المهام وتواريخها وأولوياتها وحالاتها.
- `sessions`: بيانات جلسات تسجيل الدخول.

العلاقة الأساسية هي One-to-Many بين المستخدم ومهامه، بحيث يمكن لكل مستخدم امتلاك عدة مهام.

## 6. How to Run — طريقة تشغيل المشروع

### Prerequisites

تأكد من تثبيت:

- Node.js 24 أو أحدث.
- npm.
- MySQL.
- Git.

### Installation

**Step 1 — Clone the repository**

```bash
git clone <repository-url>
cd smart-day-planner-newtech
```

استبدل `<repository-url>` برابط المستودع الفعلي.

**Step 2 — Install dependencies**

```bash
npm ci
```

**Step 3 — Configure environment variables**

أنشئ ملف `.env` من القالب `.env.example`، ثم اضبط اتصال MySQL وإعدادات الجلسة.

أهم المتغيرات:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3001
CLIENT_ORIGIN=http://127.0.0.1:5173

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=smart_day_planner_newtech

SESSION_SECRET=
```

القيم السرية وبيانات الاتصال الفعلية تُضبط محليًا ولا تُرفع إلى GitHub.

**Step 4 — Initialize the database**

عند إنشاء قاعدة المشروع لأول مرة فقط، وبعد تجهيز صلاحيات MySQL اللازمة:

```bash
npm run db:init
```

إذا كانت قاعدة البيانات مهيأة مسبقًا، تجاوز هذه الخطوة. لا تُعد تشغيل `db:init` على قاعدة موجودة.

**Step 5 — Start the application**

```bash
npm run dev
```

افتح التطبيق من المتصفح:

**Frontend:** `http://127.0.0.1:5173`

**Backend API:** `http://127.0.0.1:3001`

### Testing

لتشغيل الاختبارات المتاحة:

```bash
npm test
npm run test:integration
npm run build
```

اختبارات التكامل قد تنشئ أو تحذف بيانات اختبار؛ يُنصح بتنفيذها فقط في بيئة اختبار معزولة، وليس على قاعدة تحتوي بيانات مهمة.

## 7. Project Scope & Limitations

يركز المشروع على **التنظيم اليدوي للمهام ومتابعتها**.

لا يتضمن الإصدار الحالي ذكاءً اصطناعيًا (AI)، أو توليد جداول تلقائيًا، أو تحليل المزاج والطاقة، أو نظام إشعارات.


## 8. Project Information

**Project Name:** Smart Day Planner – NewTech

**Project Type:** Full-Stack Web Application

**Developed by:** Sara Alhamede

**Educational Program:** NewTech – Full Stack Development

**Purpose:** Graduation Project

**Development Focus:** Frontend Development, Backend APIs, Database Management, Authentication, and Testing.