
import { db } from '../lib/database';
import { PrintTemplate, TemplateAssignment } from '../types';

/**
 * PrintTemplateEngine - محرك إدارة قوالب الطباعة الذكي
 */
export const PrintTemplateEngine = {
  
  /**
   * جلب القالب المناسب للمستند الحالي (Smart Selector)
   */
  async getActiveTemplate(docType: string, branchId: string = 'MAIN'): Promise<PrintTemplate> {
    try {
      if (!docType) throw new Error("Document Type is required for template selection");

      // 1. البحث عن تعيين مخصص للفرع ونوع المستند
      const assignment = await db.db.templateAssignments
        .where('DocumentType').equals(docType)
        .and(item => item.BranchID === branchId && !!item.IsActive)
        .first();

      if (assignment && assignment.TemplateID) {
        const customTemplate = await db.db.printTemplates.get(assignment.TemplateID);
        if (customTemplate) return customTemplate;
      }

      // 2. البحث عن القالب الافتراضي لنوع المستند
      const defaultForType = await db.db.printTemplates
        .where('TemplateType').equals(docType as any)
        .and(item => item.IsDefaultTemplate === true)
        .first();

      if (defaultForType) return defaultForType;

      // 3. Fallback للقالب الأساسي للنظام
      const systemDefault = await db.db.printTemplates.where('IsDefaultTemplate').equals(1 as any).first();
      return systemDefault || {
        id: 'SYS-FALLBACK',
        TemplateID: 'SYS-FALLBACK',
        TemplateName: 'System Fallback',
        TemplateType: 'SALE',
        TemplateFormat: 'PRINT',
        TemplateLayoutJSON: '{}',
        IsDefaultTemplate: true,
        PaperSize: 'A4',
        RTL_Support: true
      };
    } catch (error) {
      console.error("[TemplateEngine] Selection Error:", error);
      return {
        id: 'SYS-FALLBACK',
        TemplateID: 'SYS-FALLBACK',
        TemplateName: 'System Fallback',
        TemplateType: 'SALE',
        TemplateFormat: 'PRINT',
        TemplateLayoutJSON: '{}',
        IsDefaultTemplate: true,
        PaperSize: 'A4',
        RTL_Support: true
      };
    }
  },

  /**
   * حفظ تصميم قالب جديد
   */
  async saveTemplate(template: PrintTemplate) {
    if (!template.TemplateID) return;
    if (!template.id) template.id = template.TemplateID;
    template.lastModified = new Date().toISOString();
    await db.db.printTemplates.put(template);
  },

  /**
   * تخصيص قالب لمستند معين
   */
  async assignTemplate(templateId: string, docType: string, branchId: string = 'MAIN') {
    if (!templateId || !docType) return;
    
    // تعطيل التعيينات السابقة لنفس النوع والفرع
    const existing = await db.db.templateAssignments
      .where('DocumentType').equals(docType)
      .filter(item => item.BranchID === branchId)
      .toArray();
    
    for (const item of existing) {
      item.IsActive = false as any;
      await db.db.templateAssignments.put(item);
    }

    const id = db.generateId('ASG');
    const newAssignment: TemplateAssignment = {
      id,
      AssignmentID: id,
      TemplateID: templateId,
      DocumentType: docType,
      BranchID: branchId,
      IsActive: true as any,
      lastModified: new Date().toISOString()
    };
    
    await db.db.templateAssignments.add(newAssignment);
  }
};
