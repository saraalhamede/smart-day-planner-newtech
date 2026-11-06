# Phase 6B.1 — تحقيق السبب الجذري لقيد FK

> تحديث لاحق: حُفظت نتائج التحقيق كما نُفذت. بموافقة مستقلة نُظفت سجلات QA المحددة بعد نسخة احتياطية؛ راجع [تقرير التنظيف والعرض المحلي](qa-cleanup-local-demo-report.md). لم يُطبق workaround ولم يستمر تحقيق OFF/ON؛ حذف السجلين التشخيصيين لا يصلح إنفاذ FK.

التاريخ: **6 نوفمبر 2026**، Asia/Jerusalem. النطاق: **تشخيص فقط**. لم يُنفذ INSERT أو UPDATE أو DELETE أو ALTER أو ترحيل أو تنظيف أو إعادة تشغيل خدمة. لم يُعدل مصدر التطبيق أو اختباراته أو مخططه أو اعتمادياته، ولم يُعالج عيب لوحة المفاتيح. بقي تقرير Phase 6A كما هو.

## 1. النتيجة وحدود اليقين

**المثبت:** السجلان305 و309 أُدرجا في الجدول الصحيح مع فحوص FK مفعلة، باستخدام مسار فحص SQL-layer. FK موجود وصحيح في المخطط الحي، وليس قيدًا مفقودًا أو علاقة موجهة لقاعدة أخرى. لم تكن النتيجة مجرد تفسير لوجود سجلات يتيمة: أُعيدت قراءة حدثي الإدخال الأصليين من binlog دون إعادة تنفيذهما.

**التفسير الجذري الأقوى، بثقة عالية:** خلل إنفاذ في مسار SQL-layer في MySQL `26.7.0`، متوافق مع [بلاغ MySQL رقم121438](https://bugs.mysql.com/bug.php?id=121438). يصف البلاغ تجاوز فحص FK عند وجود NULL في عمود آخر من الفهرس المركب الداعم، مع `innodb_native_foreign_keys=OFF`. بيئتنا تحمل الإصدار والوضع ونمط الفهارس والقيم نفسه. البلاغ **Open** وقت القراءة، وهو بلاغ فني على منصة MySQL، وليس إعلانًا بأن إصلاحًا محليًا قد اختُبر.

**المتبقي غير المثبت:** لم يُلتقط trace داخلي يحدد أي فهرس داعم اختاره المحرك لهذين الإدخالين، ولم يُنفذ اختبار مقارن OFF/ON أو تغيير الفهارس. لذلك لا ندعي إثبات الفرع البرمجي الداخلي أو نجاح workaround محليًا. إثبات الأثر السببي للإعداد البديل يتطلب اختبارًا كتابيًا وإعداد خدمة مصرحًا بهما؛ لم يُنفذا ضمن التشخيص.

بالتالي: النتيجة ليست خطأ assertion أو قاعدة مختارة خطأ. السلوك الخاطئ في قاعدة التشغيل مؤكد، وربطه بالبلاغ أعلاه استنتاج قوي قائم على أدلة، مع حد اليقين المعلن. **تبقى الشدة High** إلى أن يُعتمد حل ويُختبر؛ لا تغيير لقرار التسليم النهائي في Phase6A.

## 2. Preflight وحالة المشروع

قُرئ README وتقرير Phase6A وتقارير المراحل السابقة، وملفا schema والترحيل، وأدوات التهيئة والترحيل، وإعداد الاتصال، وrepository ومسارات المصادقة والمهام، واختبارات التكامل وأدلة QA الفعلية. الفرع `main` وHEAD ‏`b3301495d484d4e78bcd547ac006116387e3b8ec`. عند البداية كان الملف غير المتتبع الوحيد `docs/phase-6a-qa-report.md`، والفهرس فارغ. حُفظ هذا التغيير دون تعديل.

لم تُشغّل اختبارات التكامل ذات التنظيف، أو أدوات Phase6A التي تنشئ بيانات، أو أداة تنظيف Dashboard. أدوات القراءة الجديدة والأدلة المنقحة داخل `.local/` المتجاهلة فقط؛ التقرير الحالي إضافة توثيقية مستقلة.

## 3. هوية الاتصالات والقاعدة والمعاملات

الاستعلام المنفذ على اتصال القراءة الأول:

```sql
SELECT DATABASE(), VERSION(), @@version_comment, @@port, CONNECTION_ID(),
       @@session.foreign_key_checks, @@global.foreign_key_checks,
       @@session.autocommit;
```

| الخاصية | النتيجة |
| --- | --- |
| DATABASE() | smart_day_planner_newtech |
| VERSION() |26.7.0 |
| version_comment | MySQL Community Server - GPL |
| المنفذ |3306 |
| اتصال التحقيق الأول |166؛ session FK=1؛ global FK=1؛ autocommit=1 |
| اتصال ثانٍ جديد مستقل |167؛ القاعدة نفسها؛ FK=1 للجلسة والعام؛ native FK=0 |
| اتصالات المشروع المرصودة لاحقًا |165 و177؛ القاعدة نفسها؛ session FK=ON وautocommit=ON |

لا تُنسب هوية165 قطعًا إلى عملية Express بعينها لغياب tag يثبت ذلك، لكنها جلسة قائمة على قاعدة المشروع. هوية الاتصال الافتراضي الأصلي وقت Phase6A لم تُسجّل بواسطة DATABASE() آنذاك؛ **Table_map وحدثا binlog يثبتان الجدول الفعلي الذي استقبل الإدخالين**.

مراجعة المصدر:

- `server/src/config.js:6,21,30`: اسم القاعدة ثابت ومتحقق منه؛ تُرفض DB_NAME أخرى، وتدخل القاعدة نفسها في خيارات mysql2.
- `server/src/database.js:10`: pool التطبيق من `config.db` نفسه. لم يُشغّل connectDatabase في هذا التحقيق حتى لا تُنشأ timers أو عمليات مخزن جلسات.
- `.local/phase6a-api.mjs:13–14,140–142`: اتصال SQL مباشر مستقل من `readConfig().db`، لا من HTTP، بلا USE أو تغيير اتصال أو تعطيل FK أو معاملة معلقة؛ autocommit هو الافتراضي. لم تكن هذه الإدخالات عبر Tasks API.
- `.local/phase6a-db-focused.mjs:5–6,14`: اتصال جديد من الإعداد نفسه؛ القراءة للمالك4000000000 سبقت INSERT. لا إعداد FK أو transaction يفسر اختلاف القاعدة.
- `server/src/tasks/repository.js:20–24,60`: التطبيق يكتب داخل معاملة بعد locking read لوجود المستخدم؛ اتصال التطبيق يختلف عن اتصال التشخيص، لكن قاعدة البيانات والجدول الهدف مطابقان.
- أداة QA للخدمات غيرت PORT وCLIENT_ORIGIN للعملية فقط، ولم تغير DB_NAME أو إعدادات MySQL.

لم يُعثر في مصدر التطبيق أو التهيئة أو ترحيل المهام أو أدوات Phase6A المقروءة على أمر لتعطيل `foreign_key_checks`. ولم يظهر مرجع لهذا المتغير في مصدر mysql2 المثبت الذي فُحص. هذا فحص مصدر، لا بديل عن دليل حالة الجلسة التاريخية أدناه.

## 4. المخطط الحي وmetadata

نُفذت قراءة **SHOW CREATE TABLE** للجدولين بأسماء مؤهلة بالقاعدة، وقراءة `information_schema.TABLES/COLUMNS/KEY_COLUMN_USAGE/REFERENTIAL_CONSTRAINTS/TABLE_CONSTRAINTS/STATISTICS/INNODB_FOREIGN/INNODB_FOREIGN_COLS`.

| الفحص | النتيجة الحية |
| --- | --- |
| نوع الجدولين | BASE TABLE؛ لا views أو temporary tables |
| المحرك | users وtasks كلاهما InnoDB |
| نوع العمودين | tasks.user_id وusers.id كلاهما INT UNSIGNED NOT NULL |
| FK | tasks_user_fk موجود؛ TABLE_CONSTRAINTS يعرض ENFORCED=YES |
| المرجع | smart_day_planner_newtech.tasks.user_id → smart_day_planner_newtech.users.id |
| فهرس الأب | PRIMARY في قاعدة المشروع نفسها |
| الإجراءات | DELETE RESTRICT؛ UPDATE NO ACTION |
| قاموس InnoDB | ID=`smart_day_planner_newtech/tasks_user_fk`؛ N_COLS=1؛ user_id→id |
| وقت إنشاء tasks |2026-11-05 13:08:34 |
| وقت إنشاء users |2026-11-05 12:52:48 |

تعريف tasks الفعلي الكامل، من SHOW CREATE TABLE أثناء التحقيق، دون تغييره:

```sql
CREATE TABLE `tasks` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `title` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `task_date` date NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `priority` enum('low','medium','high') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'medium',
  `status` enum('waiting','in_progress','completed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'waiting',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `in_progress_date` date GENERATED ALWAYS AS (if((`status` = _utf8mb4'in_progress'),`task_date`,NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tasks_one_in_progress` (`user_id`,`in_progress_date`),
  KEY `tasks_user_date_time` (`user_id`,`task_date`,`start_time`,`end_time`),
  KEY `tasks_user_status_priority` (`user_id`,`status`,`priority`,`task_date`),
  CONSTRAINT `tasks_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `tasks_time_check` CHECK ((((`start_time` is null) and (`end_time` is null)) or ((`start_time` is not null) and (`end_time` is not null) and (`start_time` >= _utf8mb4'00:00:00') and (`end_time` < _utf8mb4'24:00:00') and (`start_time` < `end_time`)))),
  CONSTRAINT `tasks_title_check` CHECK ((char_length(trim(`title`)) between 1 and 180))
) ENGINE=InnoDB AUTO_INCREMENT=310 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

الجدول users الفعلي InnoDB وعموده `id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY`. لا اختلاف في نوع أو إشارة العمود المرجعي، ولا إحالة لجدول آخر.

الفهارس الداعمة ذات الصلة:

| الفهرس | الأعمدة بالترتيب | أعمدة تقبل NULL |
| --- | --- | --- |
| tasks_one_in_progress؛ UNIQUE |user_id,in_progress_date |in_progress_date |
| tasks_user_date_time؛ non-unique |user_id,task_date,start_time,end_time |start_time,end_time |
| tasks_user_status_priority؛ non-unique |user_id,status,priority,task_date |لا يوجد |

السجلان اليتيمان waiting، وغير مؤقتين؛ `in_progress_date` وstart/end تكون NULL وفق البيانات والتعريف ومصدر الإدخال. هذه ملاحظة بنيوية مطابقة لنمط البلاغ؛ لا تحدد وحدها أي فهرس اختاره فحص FK فعليًا.

الترحيل `server/db/migrations/002-tasks.sql:15,24` يعرّف FK الصحيح وInnoDB. `init-db.js:12–16` يختار القاعدة الجديدة قبل تنفيذ schema والترحيل، و`migrate-db.js:7–10` ينفذ CREATE TABLE مرة واحدة على القاعدة الحالية دون إسقاط أو تعطيل FK. **الأهم من وجود SQL في الملف:** تعريف tasks الحي، بعد استثناء عداد AUTO_INCREMENT، يطابق بصمة التعريف المحفوظة قبل إدخالات Phase6A؛ وكانت المهام آنذاك صفرًا. لا دليل على أن السجلين سبقا إنشاء القيد.

## 5. الإعدادات الحالية والتاريخية

قراءات SELECT وSHOW فقط:

| المتغير/الدليل | القيمة |
| --- | --- |
| session.foreign_key_checks |1 في اتصالي التحقيق المستقلين |
| global.foreign_key_checks |1/ON |
| global.innodb_native_foreign_keys |0/OFF |
| مصدر native FK في variables_info |COMPILED؛ الإعداد الافتراضي المترجم |
| مصدر global FK |DYNAMIC؛ آخر SET_TIME ظاهر 2026-10-19 20:49:07.502792 |
| init_connect |فارغ؛ لا تعليمة لتعطيل FK |
| general_log |OFF؛ لم يُفعل |
| events_statements_history_long |NO؛ لم يُفعل |
| binlog |ON؛ ROW |

لا يمكن استنتاج إعداد جلسة قديمة من قراءة جلسة جديدة فقط. لذلك فُحص binlog الأصلي، بدل الاكتفاء بالقيم أعلاه. دليل MySQL يوضح أن `foreign_key_checks` متغير ذو نطاقين، وأن إعادة تمكينه لا تفحص السجلات السابقة تلقائيًا؛ **وجود orphan وحده لا يثبت تعطل القيد الآن**. [مرجع فحوص FK](https://dev.mysql.com/doc/refman/26.7/en/create-table-foreign-keys.html).

### دليل الحدثين الأصليين

فشلت القراءة المباشرة لملفات السجل محليًا بـ`OS errno13 — Permission denied`. لم تُغير صلاحيات Windows. نجحت القراءة عبر بروتوكول binlog الموثق لدى MySQL باستخدام الحساب المحلي الموجود. عولج الإخراج في الذاكرة واستُخرجت فقط معرفات الحدثين وأعلامهما؛ لا dump خام أو replay أو بيانات مستخدمين أو بيانات اعتماد محفوظة في التقرير. تم التحقق من checksum أثناء القراءة.

| Task | User_id غير الموجود | وقت الحدث المحلي | موضع الحدث→نهايته | أعلام Write_rows |
| --- | --- | --- | --- | --- |
|305 |4294967295 |2026-11-06 11:12:25 |491280→491359 |STMT_END_F USE_SQL_FOREIGN_KEY_F |
|309 |4000000000 |2026-11-06 11:17:42 |509082→509166 |STMT_END_F USE_SQL_FOREIGN_KEY_F |

في الحدثين: `NO_FOREIGN_KEY_CHECKS_F` **غير مضبوط**، وسياق SET الذي أعاد mysqlbinlog تكوينه هو `foreign_key_checks=1`. Table_map/row target هو `smart_day_planner_newtech.tasks`، table id122. هذا دليل تاريخي على أن **الإدخالين محل التحقيق لم ينفذا مع تعطيل فحوص FK**، وأن التنفيذ كان في مسار SQL-layer. لا يعمم هذا الاستنتاج على كل العمليات التاريخية الأخرى غير المفحوصة.

دلالة الأعلام مدعومة بتوثيق مصدر MySQL للإصدار نفسه: `NO_FOREIGN_KEY_CHECKS_F` يمثل تعطيل الفحص في خيارات الجلسة، و`USE_SQL_FOREIGN_KEY_F` يميز استخدام معالجة SQL بدل فحص InnoDB الأصلي. [مرجع Rows_event 26.7.0](https://dev.mysql.com/doc/dev/mysql-server/26.7.0/classmysql_1_1binlog_1_1event_1_1Rows__event.html).

**تمييز مهم:** `innodb_native_foreign_keys=OFF` ليس مرادفًا لـ`foreign_key_checks=0`. الأول يختار منفذ الفحص؛ الثاني يعطّل الفحص. الوضع الحالي يختار SQL-layer، مع بقاء الفحص مطلوبًا. هذا موثق في [معالجة FK](https://dev.mysql.com/doc/refman/26.7/en/create-table-foreign-keys.html) و[متغير InnoDB](https://dev.mysql.com/doc/refman/26.7/en/innodb-parameters.html#sysvar_innodb_native_foreign_keys).

## 6. لماذا فشل الاختبار؟ وما الذي استُبعد؟

`API-20` في `.local/phase6a-api.mjs:141` يتوقع رفض Promise الخاصة بإدخال مالك4294967295 بـ`ER_NO_REFERENCED_ROW_2`، أي خطأ1452. عادت العملية بنجاح، ففشل assert برسالة `Missing expected rejection.`. توقف هذا السيناريو قبل اختبار CHECK الوقت؛ اختبار الوقت نُفذ لاحقًا ونجح منفصلًا. `DB-FK` في `.local/phase6a-db-focused.mjs:14` كرر التوقع بمالك4000000000 وقُبل كذلك. كلا الإدخالين مثبتان بالـbinlog والسجلات الحالية؛ ليس الفشل مجرد توقع error-code آخر.

| الاحتمال | نتيجة التحقيق |
| --- | --- |
| FK مفقود أو في جدول آخر |مستبعد بالـDDL وKEY_COLUMN_USAGE وقاموس InnoDB |
| نوع عمود أو index الأب غير مناسب |مستبعد؛ unsigned متطابق وPRIMARY للأب |
| جدول MyISAM أو view |مستبعد؛ BASE TABLE/InnoDB |
| قاعدة مختلفة في الاختبار |هدف الإدخالين في binlog هو قاعدة المشروع؛ الإعداد أيضًا مقيد بها |
| تعطيل session FK للإدخالين |مستبعد بأعلام الحدثين؛ لا نعتمد على جلسة لاحقة |
| orphan قديم قبل وجود FK |مستبعد لهذه الحادثة: تعريف مطابق قبل Phase6A وصفر مهام آنذاك |
| معاملة لم تُحفظ أو قراءة خاصة بالاتصال |مستبعد؛ سجل binlog وقراءات اتصالات مستقلة تثبت الحفظ |
| assertion أو harness مزيف للنتيجة |لا؛ native binlog يؤكد الكتابتين بعيدًا عن mysql2/HTTP |
| خلل SQL-layer متوافق مع121438 |التفسير المدعوم الأقوى؛ لا اختبار A/B محلي بعد |

## 7. النطاق والأثر والشدة

- الأثر المرصود محصور في **سجلي QA التشخيصيين305 و309**. لا دليل على orphan إضافي أو تغيير بيانات المستخدم الأصلي. هذا لا يجعل مسار المحرك آمنًا لكتابات مستقبلية.
- توجد4 حسابات و12 مهمة كما كانت عند بداية التحقيق: الحساب الأصلي وثلاثة QA، و10 مهام مملوكة واثنتان يتيمتان. تطابقت hashes لجميع صفوف users/tasks قبل التحقيق وبعده؛ لم يُحذف أو يُحدّث أي صف. لا ادعاء بوجود بيانات مستخدم حقيقية تالفة؛ الحساب الأصلي لم يكن له مهام عند بداية Phase6A.
- حماية API ما زالت قائمة: `require-auth.js` يستمد المستخدم من الجلسة، و`tasks/routes.js` يمرر `req.user.id`، وvalidation يرفض `user_id`، وrepository يقرأ وجود المستخدم بقفل قبل الإنشاء ويفلتر القراءة والتعديل بالمالك. اختبارات العزل السابقة نجحت؛ **لم يُعد تشغيلها أو إنشاء حسابات جديدة هنا**.
- الخطأ قد يسمح ببيانات غير متسقة عبر SQL مباشر أو مسار استيراد/كتابة آخر يعتمد على FK وحده. لم يثبت تجاوز ملكية أو تسريب عبر API. لا نُعمم فحصنا على قواعد أخرى في الخدمة.
- **High تبقى مناسبة** لضمان سلامة البيانات والتسليم؛ ليست Critical لأن تجاوز المصادقة/الملكية لم يثبت. السبب المرجح في بيئة DB/تنفيذ المحرك، لا في تعريف العلاقة أو تحققات React.

## 8. أصغر مسار إصلاح آمن مقترح — لم يُنفذ

لا حاجة مثبتة لإعادة إنشاء FK أو تعديل API أو إعادة كتابة Tasks CRUD. تغيير assertion ليقبل النجاح سيخفي المشكلة، وليس تصحيح اختبار مشروع.

**المسار الأول المقترح للتحقق:** اختبار معالجة InnoDB الأصلية باستخدام إعداد بدء التشغيل `innodb_native_foreign_keys=ON` على بيئة QA معزولة أو ضمن توقف خدمة معتمد. هذا workaround مذكور في البلاغ، **ولم يثبت نجاحه محليًا بعد**. تصنيفه تغيير إعداد MySQL وإعادة تشغيل، لا migration ولا تعديل كود التطبيق. توثيق MySQL يحدد المتغير Global وغير Dynamic؛ لا يُعرض كأمر SET SESSION أو SET GLOBAL آني. لا حاجة لخفض `foreign_key_checks` عن1.

تشغيله على الخدمة المشتركة يؤثر في كل جداول InnoDB واتصالاتها ويتطلب توقفًا وإعادة اتصال، لذلك يحتاج تفويضًا منفصلًا وخطة تراجع ونسخة احتياطية مناسبة قبل التغيير. لم تُفتح أو تُعدّل ملفات إعداد الخدمة ضمن هذا العمل. البديل إصدار محرك يتضمن إصلاحًا موثقًا ومثبتًا، دون افتراض أن إصدارًا أحدث بعينه أصلح البلاغ المفتوح.

إضافة فهرس مخصص أحادي `user_id` قد تكون فرضية workaround محلية، لكنها تحتاج migration واختبارًا مستقلًا؛ **ليست حلًا مثبتًا أو مختارًا**. لا أوصي بإسقاط الفهرس الفريد `tasks_one_in_progress` أو تغيير قابلية NULL للعمود المولد، لأنهما ينفذان قاعدة MVP مهمة.

أي حل للإنفاذ لا يُعد تنظيفًا للسجلين الحاليين. يبقيان دون حذف أو إعادة إسناد إلى مستخدم آخر، وأي معالجة لهما تحتاج موافقة مستقلة.

## 9. خطة التحقق بعد موافقة مستقلة

1. حفظ بصمات الصفوف والتعريفات، وتسجيل DATABASE وCONNECTION_ID وVERSION وsession/global FK وnative mode **في الاتصال نفسه** الذي ينفذ كل probe.
2. اعتماد تجربة مقارنة محددة قبل أي تغيير: حالات waiting/in_progress/completed، مؤقتة وغير مؤقتة، لمالك غير موجود. المتوقع رفضها كلها بخطأ1452، بغض النظر عن NULL في أعمدة أخرى. لا يُختبر ذلك الآن.
3. يمكن، بعد تصريح صريح بالكتابة، استخدام معاملة مخصصة وإدخالات تشخيصية ثمROLLBACK لمنع بقاء صف جديد، مع عدم لمس السجلات الـ12 القائمة. مقارنة OFF/ON تحتاج أيضًا تفويض تغيير وضع خدمة/بيئة QA؛ لا يمكن تبديله لكل جلسة لأن المتغير غير Dynamic.
4. تأكيد نجاح المالك الصحيح، وقاعدة مهمة نشطة واحدة، ومنع التداخل، ثم تراجع المصادقة والملكية والحفظ. عدم إعادة تشغيل suite التنظيف قبل اعتماد سلوكه.
5. مقارنة hashes وعدد السجلات والتعريفات بعد التجربة. إذا بقي السجلان القديمان فلا يُسمّى الفحص فاشلًا لمجرد وجودهما؛ يُفصل منع الكتابة الجديدة عن إصلاح البيانات السابقة.
6. توسيع اختبار FK المباشر وتسجيل إعداداته بعد اعتماد تعديل الاختبارات؛ هذا تحسين تغطية، لا تصحيح false positive أو تغيير API. مراجعة قرار التسليم بعد نجاح التحقق، وليس بناء على metadata أو بلاغ خارجي وحدهما.

**التوقف المطلوب:** لم تُنفذ أي خطوة كتابية من هذه الخطة. يلزم تفويض جديد قبل الاختبار المقارن أو تطبيق workaround أو تنظيف أي سجل.

## 10. Git والأدلة

بقي الفرع `main` وHEAD ‏`b3301495d484d4e78bcd547ac006116387e3b8ec`. الفهرس فارغ. التغييران غير المتتبعين المقصودان هما تقرير Phase6A السابق وهذا التقرير؛ لا diff في المصدر أو SQL أو config أو dependencies. لا commit أو push أو إعداد Presentation أو إصلاح عيب لوحة المفاتيح.

الأدلة المحلية المتجاهلة: `.local/phase6b1-evidence.json` للمخطط والmetadata والإعدادات؛ `.local/phase6b1-binlog-evidence.json` لحدثي الكتابة المنقحين؛ `.local/phase6b1-preservation.json` لبقاء جميع4 مستخدمين و12 مهمة. لم يُحفظ dump خام، ولم تُدرج كلمات مرور أو cookies أو hashes كلمات مرور أو بيانات شخصية في التقرير. أداة mysqlbinlog تلقت سر الاتصال في بيئة عملية فرعية مؤقتة فقط، لا في command-line أو ملف التقرير.
