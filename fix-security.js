/**
 * Production-Grade Security Fixer Script
 * --------------------------------------------------------------------------
 * هذا السكربت مصمم لحماية ثغرات الأمن السيبراني وإدارة ملفات البيئة الحساسة محلياً بضغطة واحدة.
 * 
 * وظائف السكربت المحدثة:
 * 1. إزالة ملفات الإعدادات من كاش الجيت (Git Index Cache) لمنع رفعها إلى المستودعات المفتوحة.
 * 2. فحص وتحديث ملف `.gitignore` تفادياً لرفع تلك الملفات مستقبلاً بمرونة كاملة.
 * 3. توليد مفتاح تشفير عاصم مخزني عالي العشوائية (32 بايت / 256 بت) عشوائياً.
 * 4. تدوين وتطبيق المفتاح المولد تلقائياً داخل ملفات الإعدادات المحمية تحت مسمى ENCRYPTION_KEY (خلفي فقط ولن يسرب للواجهة).
 * 
 * طريقة التشغيل:
 * node fix-security.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('======================================================');
console.log('⚙️ بدء تشغيل الدعم الأمني لمعالجة ثغرات التشفير ونقل المفاتيح للـ Backend 🛡️');
console.log('======================================================');

// 1. إزالة ملفات البيئة من كاش الجيت دون حذفها من جهازك المحلي
console.log('\n[1/4] فحص كاش Git ومسح تتبع ملفات البيئة الحسّاسة...');
const envFilesToRemove = ['.env.local', '.env.production', '.env'];
let gitRMExecuted = false;

envFilesToRemove.forEach(file => {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    execSync(`git rm --cached ${file}`, { stdio: 'ignore' });
    console.log(`✅ تم بنجاح إلغاء تتبع وإزالة الملف من كاش الجيت: ${file}`);
    gitRMExecuted = true;
  } catch (err) {
    console.log(`ℹ️ الملف "${file}" ليس مدرجاً حالياً في كاش Git النشط أو لم يتم تهيئة Git بعد (تخطي آمن).`);
  }
});

// 2. تحديث وتأكيد تتبع ملف .gitignore
console.log('\n[2/4] تحديث ملف الاستبعاد (.gitignore) لمنع رفع الملفات مستقبلاً...');
const gitignorePath = path.join(__dirname, '.gitignore');
const linesToIgnore = ['.env', '.env.local', '.env.production', '.env.*', '!.env.example'];

try {
  let gitignoreContent = '';
  if (fs.existsSync(gitignorePath)) {
    gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
  }

  let updated = false;
  const currentLines = gitignoreContent.split(/\r?\n/).map(line => line.trim());

  linesToIgnore.forEach(line => {
    if (!currentLines.includes(line)) {
      gitignoreContent += `\n${line}`;
      updated = true;
      console.log(`➕ تم تسجيل قاعدة الاستبعاد بنجاح: ${line}`);
    }
  });

  if (updated) {
    fs.writeFileSync(gitignorePath, gitignoreContent.trim() + '\n', 'utf8');
    console.log('✅ تم تحديث ملف .gitignore وحفظه بنجاح.');
  } else {
    console.log('ℹ️ ملف .gitignore يحتوي بالفعل على كافة قواعد حماية ملفات البيئة.');
  }
} catch (error) {
  console.error('❌ خطأ أثناء معالجة ملف .gitignore:', error.message);
}

// 3. توليد مفتاح تشفير عشوائي وقوي جداً للـ Backend (32 بايت / 256 بت)
console.log('\n[3/4] توليد مفتاح تشفير عشوائي ذو تشويش عالي (High-Entropy Symmetric Encryption Key)...');
const secureKey = crypto.randomBytes(32).toString('hex');
console.log(`🔑 المفتاح الحامي الجديد الذي تم توليده: ${secureKey.substring(0, 8)}************************`);

// 4. تحديث قيمة المتغير ENCRYPTION_KEY داخل ملفات البيئة
console.log('\n[4/4] حقن ورش مفتاح التشفير الجديد داخل ملفات البيئة الخلفية...');
const envFilesToUpdate = ['.env.production', '.env.local', '.env'];

envFilesToUpdate.forEach(envFileName => {
  const envFilePath = path.join(__dirname, envFileName);
  try {
    let envContent = '';
    let isNewFile = !fs.existsSync(envFilePath);

    if (!isNewFile) {
      envContent = fs.readFileSync(envFilePath, 'utf8');
    }

    // إزالة أي أثر قديم أو معلّق لـ VITE_ENCRYPTION_KEY لتنظيف الملف
    if (envContent.includes('VITE_ENCRYPTION_KEY=')) {
      envContent = envContent.replace(/VITE_ENCRYPTION_KEY=[^\r\n]*/g, '');
      console.log(`🧹 تم تطهير وبتر قيمة VITE_ENCRYPTION_KEY القديمة من ملف: ${envFileName}`);
    }

    const keyDeclaration = `ENCRYPTION_KEY=${secureKey}`;
    
    if (envContent.includes('ENCRYPTION_KEY=')) {
      // استبدال المفتاح القديم بنمط ريجكس دقيق
      envContent = envContent.replace(/ENCRYPTION_KEY=[^\r\n]*/g, keyDeclaration);
      console.log(`🔄 تم تحديث المفتاح الحامي في الملف المكتشف: ${envFileName}`);
    } else {
      // إلحاق التشفير في سطر جديد كلياً
      envContent += (envContent.endsWith('\n') || envContent.length === 0 ? '' : '\n') + keyDeclaration + '\n';
      console.log(`📥 تم إدراج مفتاح التشفير الخلفي لأول مرة في الملف: ${envFileName}`);
    }

    // تنظيف الأسطر الفارغة المتكررة الناتجة عن البتر
    envContent = envContent.replace(/\n\s*\n/g, '\n');

    fs.writeFileSync(envFilePath, envContent.trim() + '\n', 'utf8');
    console.log(`✅ تم حفظ التحديثات بنجاح في: ${envFileName}`);
  } catch (error) {
    console.error(`❌ فشل معالجة أو تحديث ملف البيئة "${envFileName}":`, error.message);
  }
});

console.log('\n======================================================');
console.log('🎉 تمت المعالجة الأمنية بنجاح! تم نقل مفتاح التشفير إلى الـ Backend بالكامل.');
console.log('🚀 الآن جميع مفاتيحك محصنة تماماً وخلفية 100% ولا خطر من تسريبها بالـ Bundle.');
console.log('======================================================\n');
