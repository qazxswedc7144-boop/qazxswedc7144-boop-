
export const templateEngineService = {
  render: (_template: string, _data: any) => {
    return '';
  }
};

export const PrintTemplateEngine = {
  getActiveTemplate: async (_type: string) => {
    return {
      TemplateName: 'Default Template',
      TemplateLayoutJSON: JSON.stringify({
        primaryColor: '#1E4D4D',
        font: 'Cairo'
      }),
      RTL_Support: true
    };
  }
};
