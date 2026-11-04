import { applyMapping, suggestMapping } from './csv.util';

describe('csv mapping', () => {
  const fields = [
    { name: 'firstName', label: 'First Name' },
    { name: 'company', label: 'Company' },
    { name: 'email', label: 'Email' },
  ];

  it('suggests fields from header labels', () => {
    expect(suggestMapping(['First Name', 'Company Name', 'Email Address'], fields)).toEqual({
      'First Name': 'firstName',
      'Company Name': 'company',
      'Email Address': 'email',
    });
  });

  it('applies a mapping onto a row', () => {
    expect(applyMapping({ Name: 'Ada', Co: 'Analytical Engines' }, { Name: 'firstName', Co: 'company', Missing: '' })).toEqual({
      firstName: 'Ada',
      company: 'Analytical Engines',
    });
  });
});
