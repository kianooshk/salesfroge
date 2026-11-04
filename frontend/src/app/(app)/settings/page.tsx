'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { person } from '@/lib/format';
import { useApp } from '@/components/Shell';
import { Banner } from '@/components/ui';

const ACTIONS = ['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'];
const OBJECTS = ['Lead', 'Account', 'Contact', 'Opportunity', 'Case', 'Activity', 'CustomRecord'];
const FIELD_TYPES = ['text', 'textarea', 'number', 'currency', 'date', 'datetime', 'picklist', 'email', 'phone', 'url'];

export default function SettingsPage() {
  const { me, users, teams } = useApp();
  const [tab, setTab] = useState('Users');
  const [roles, setRoles] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ firstName: '', lastName: '', email: '', password: 'salesfroge', roleId: '', title: '' });
  const [roleForm, setRoleForm] = useState({ name: '', parentId: '', description: '' });
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [teamForm, setTeamForm] = useState({ name: '', description: '' });
  const [member, setMember] = useState({ teamId: '', userId: '', role: 'member' });
  const [objects, setObjects] = useState<any[]>([]);
  const [objectForm, setObjectForm] = useState({ label: '', pluralLabel: '', apiKey: '' });
  const [fieldForm, setFieldForm] = useState({ objectType: 'Account', label: '', apiName: '', type: 'text', options: '' });
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '' });

  function loadRoles() { api('/roles').then((rows) => { setRoles(rows); setSelectedRole((current: any) => rows.find((role: any) => role.id === current?.id) || rows[0] || null); }); }

  useEffect(() => {
    loadRoles();
    api('/custom-objects').then(setObjects).catch(() => undefined);
    api('/email/templates').then(setTemplates).catch(() => undefined);
  }, []);

  async function guard(work: () => Promise<void>) {
    setError(null);
    try { await work(); } catch (err: any) { setError(err.message); }
  }

  return (
    <div>
      <Banner error={error} />
      <div className="slds-page-header">
        <h1 className="slds-page-header__title">Setup</h1>
        <p className="sf-muted">{me.isAdmin ? 'You are an administrator.' : 'Some setup actions are limited to administrators.'}</p>
      </div>
      <ul className="slds-tabs_default__nav slds-m-top_medium" role="tablist">
        {['Users', 'Roles', 'Teams', 'Objects', 'Email'].map((name) => (
          <li key={name} className={`slds-tabs_default__item ${tab === name ? 'slds-is-active' : ''}`}>
            <button className="slds-tabs_default__link sf-path-btn" onClick={() => setTab(name)}>{name}</button>
          </li>
        ))}
      </ul>

      {tab === 'Users' && (
        <div className="slds-m-top_medium">
          <table className="slds-table slds-table_cell-buffer slds-table_bordered sf-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Admin</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td data-label="Name">{person(user)}<div className="sf-muted">{user.title}</div></td>
                  <td data-label="Email">{user.email}</td>
                  <td data-label="Role">
                    <select className="slds-select" value={user.roleId || ''} disabled={!me.isAdmin} onChange={(e) => guard(async () => { await api(`/users/${user.id}`, { method: 'PATCH', body: { roleId: e.target.value } }); location.reload(); })}>
                      <option value="">None</option>
                      {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                  </td>
                  <td data-label="Active"><input type="checkbox" checked={user.isActive} disabled={!me.isAdmin} onChange={(e) => guard(async () => { await api(`/users/${user.id}`, { method: 'PATCH', body: { isActive: e.target.checked } }); location.reload(); })} /></td>
                  <td data-label="Admin"><input type="checkbox" checked={user.isAdmin} disabled={!me.isAdmin} onChange={(e) => guard(async () => { await api(`/users/${user.id}`, { method: 'PATCH', body: { isAdmin: e.target.checked } }); location.reload(); })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {me.isAdmin && (
            <article className="slds-card slds-m-top_medium">
              <div className="slds-card__header"><h2 className="slds-card__header-title">New user</h2></div>
              <div className="slds-card__body slds-card__body_inner slds-grid slds-wrap">
                {(['firstName', 'lastName', 'email', 'password', 'title'] as const).map((key) => (
                  <div key={key} className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-p-horizontal_x-small slds-m-bottom_x-small">
                    <input className="slds-input" placeholder={key} type={key === 'password' ? 'password' : 'text'} value={(userForm as any)[key]} onChange={(e) => setUserForm({ ...userForm, [key]: e.target.value })} />
                  </div>
                ))}
                <div className="slds-col slds-size_1-of-1 slds-p-horizontal_x-small">
                  <select className="slds-select" value={userForm.roleId} onChange={(e) => setUserForm({ ...userForm, roleId: e.target.value })}>
                    <option value="">Role</option>
                    {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                  </select>
                  <button className="slds-button slds-button_brand slds-m-top_small" onClick={() => guard(async () => { await api('/users', { method: 'POST', body: userForm }); location.reload(); })}>Create user</button>
                </div>
              </div>
            </article>
          )}
        </div>
      )}

      {tab === 'Roles' && (
        <div className="sf-two slds-m-top_medium">
          <ul className="slds-has-dividers_around-space">
            {roles.map((role) => (
              <li key={role.id} className="slds-item">
                <button className="slds-button slds-button_reset" onClick={() => setSelectedRole(role)}><strong>{role.name}</strong></button>
                <div className="sf-muted">Reports to {role.parent?.name || 'nobody'} · {role._count?.users || 0} people</div>
              </li>
            ))}
          </ul>
          {selectedRole && (
            <article className="slds-card">
              <div className="slds-card__header"><h2 className="slds-card__header-title">{selectedRole.name}</h2></div>
              <div className="slds-card__body slds-card__body_inner" style={{ overflowX: 'auto' }}>
                <label className="slds-form-element__label">Parent role</label>
                <select className="slds-select slds-m-bottom_small" value={selectedRole.parentId || ''} disabled={!me.isAdmin} onChange={(e) => setSelectedRole({ ...selectedRole, parentId: e.target.value })}>
                  <option value="">None</option>
                  {roles.filter((role) => role.id !== selectedRole.id).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
                <table className="slds-table slds-table_cell-buffer slds-table_bordered">
                  <thead><tr><th>Object</th>{ACTIONS.map((action) => <th key={action}>{action}</th>)}</tr></thead>
                  <tbody>
                    {OBJECTS.map((object) => (
                      <tr key={object}>
                        <td>{object}</td>
                        {ACTIONS.map((action) => (
                          <td key={action}>
                            <input type="checkbox" checked={!!selectedRole.permissions?.[object]?.[action]} disabled={!me.isAdmin} onChange={(e) => {
                              const permissions = { ...(selectedRole.permissions || {}) };
                              permissions[object] = { ...(permissions[object] || {}), [action]: e.target.checked };
                              setSelectedRole({ ...selectedRole, permissions });
                            }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {me.isAdmin && <button className="slds-button slds-button_brand slds-m-top_small" onClick={() => guard(async () => { await api(`/roles/${selectedRole.id}`, { method: 'PATCH', body: { parentId: selectedRole.parentId || null, permissions: selectedRole.permissions } }); loadRoles(); })}>Save role</button>}
              </div>
            </article>
          )}
          {me.isAdmin && (
            <article className="slds-card">
              <div className="slds-card__body slds-card__body_inner">
                <h2 className="slds-text-heading_small">New role</h2>
                <input className="slds-input slds-m-bottom_x-small" placeholder="Name" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} />
                <input className="slds-input slds-m-bottom_x-small" placeholder="Description" value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} />
                <select className="slds-select" value={roleForm.parentId} onChange={(e) => setRoleForm({ ...roleForm, parentId: e.target.value })}>
                  <option value="">Parent</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
                <button className="slds-button slds-button_neutral slds-m-top_small" onClick={() => guard(async () => { await api('/roles', { method: 'POST', body: roleForm }); setRoleForm({ name: '', parentId: '', description: '' }); loadRoles(); })}>Add role</button>
              </div>
            </article>
          )}
        </div>
      )}

      {tab === 'Teams' && (
        <div className="slds-m-top_medium">
          {teams.map((team) => (
            <article key={team.id} className="slds-card slds-m-bottom_small">
              <div className="slds-card__header"><h2 className="slds-card__header-title">{team.name}</h2></div>
              <div className="slds-card__body slds-card__body_inner">
                <p className="sf-muted">{team.description}</p>
                <ul>{(team.members || []).map((item: any) => <li key={item.id}>{person(item.user)} · {item.role} {me.isAdmin && <button className="slds-button slds-button_reset" onClick={() => guard(async () => { await api(`/teams/${team.id}/members/${item.userId}`, { method: 'DELETE' }); location.reload(); })}>Remove</button>}</li>)}</ul>
              </div>
            </article>
          ))}
          {me.isAdmin && (
            <article className="slds-card">
              <div className="slds-card__body slds-card__body_inner">
                <input className="slds-input slds-m-bottom_x-small" placeholder="Team name" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
                <input className="slds-input slds-m-bottom_x-small" placeholder="Description" value={teamForm.description} onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })} />
                <button className="slds-button slds-button_brand" onClick={() => guard(async () => { await api('/teams', { method: 'POST', body: teamForm }); location.reload(); })}>Create team</button>
                <div className="slds-grid slds-gutters_x-small slds-m-top_medium">
                  <select className="slds-select" value={member.teamId} onChange={(e) => setMember({ ...member, teamId: e.target.value })}>
                    <option value="">Team</option>
                    {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                  </select>
                  <select className="slds-select" value={member.userId} onChange={(e) => setMember({ ...member, userId: e.target.value })}>
                    <option value="">User</option>
                    {users.map((user) => <option key={user.id} value={user.id}>{person(user)}</option>)}
                  </select>
                  <button className="slds-button slds-button_neutral" onClick={() => guard(async () => { await api(`/teams/${member.teamId}/members`, { method: 'POST', body: { userId: member.userId, role: member.role } }); location.reload(); })}>Add member</button>
                </div>
              </div>
            </article>
          )}
        </div>
      )}

      {tab === 'Objects' && (
        <div className="slds-m-top_medium">
          <p className="slds-m-bottom_small">Custom objects and fields are stored as data. No deploy is required.</p>
          {objects.map((object) => (
            <article key={object.id} className="slds-card slds-m-bottom_small">
              <div className="slds-card__header slds-grid slds-grid_align-spread">
                <h2 className="slds-card__header-title">{object.pluralLabel} <span className="sf-muted">({object.apiKey})</span></h2>
                {me.isAdmin && <button className="slds-button slds-button_text-destructive" onClick={() => guard(async () => { await api(`/custom-objects/${object.id}`, { method: 'DELETE' }); setObjects(await api('/custom-objects')); })}>Delete</button>}
              </div>
              <ul className="slds-p-horizontal_medium">{object.fields.map((field: any) => <li key={field.id}>{field.label} · {field.type}</li>)}</ul>
            </article>
          ))}
          <article className="slds-card">
            <div className="slds-card__body slds-card__body_inner">
              <h2 className="slds-text-heading_small">New custom object</h2>
              <input className="slds-input slds-m-bottom_x-small" placeholder="Label" value={objectForm.label} onChange={(e) => setObjectForm({ ...objectForm, label: e.target.value })} />
              <input className="slds-input slds-m-bottom_x-small" placeholder="Plural label" value={objectForm.pluralLabel} onChange={(e) => setObjectForm({ ...objectForm, pluralLabel: e.target.value })} />
              <input className="slds-input slds-m-bottom_x-small" placeholder="API key (lowercase)" value={objectForm.apiKey} onChange={(e) => setObjectForm({ ...objectForm, apiKey: e.target.value })} />
              <button className="slds-button slds-button_brand" onClick={() => guard(async () => { await api('/custom-objects', { method: 'POST', body: objectForm }); location.reload(); })}>Create object</button>
              <h2 className="slds-text-heading_small slds-m-top_large">New field</h2>
              <select className="slds-select slds-m-bottom_x-small" value={fieldForm.objectType} onChange={(e) => setFieldForm({ ...fieldForm, objectType: e.target.value })}>
                {OBJECTS.filter((name) => name !== 'CustomRecord').map((name) => <option key={name} value={name}>{name}</option>)}
                {objects.map((object) => <option key={object.id} value={`api:${object.apiKey}`}>{object.label}</option>)}
              </select>
              <input className="slds-input slds-m-bottom_x-small" placeholder="Label" value={fieldForm.label} onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })} />
              <input className="slds-input slds-m-bottom_x-small" placeholder="API name" value={fieldForm.apiName} onChange={(e) => setFieldForm({ ...fieldForm, apiName: e.target.value })} />
              <select className="slds-select slds-m-bottom_x-small" value={fieldForm.type} onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value })}>
                {FIELD_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
              {fieldForm.type === 'picklist' && <input className="slds-input slds-m-bottom_x-small" placeholder="Options, comma separated" value={fieldForm.options} onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })} />}
              <button className="slds-button slds-button_neutral" onClick={() => guard(async () => {
                const payload: any = { label: fieldForm.label, apiName: fieldForm.apiName, type: fieldForm.type, options: fieldForm.type === 'picklist' ? fieldForm.options.split(',').map((item) => item.trim()).filter(Boolean) : undefined };
                if (fieldForm.objectType.startsWith('api:')) payload.apiKey = fieldForm.objectType.slice(4);
                else payload.objectType = fieldForm.objectType;
                await api('/custom-fields', { method: 'POST', body: payload });
                location.reload();
              })}>Add field</button>
            </div>
          </article>
        </div>
      )}

      {tab === 'Email' && (
        <div className="slds-m-top_medium">
          {templates.map((template) => (
            <article key={template.id} className="slds-card slds-m-bottom_small">
              <div className="slds-card__header slds-grid slds-grid_align-spread">
                <h2 className="slds-card__header-title">{template.name}</h2>
                <button className="slds-button slds-button_reset" onClick={() => guard(async () => { await api(`/email/templates/${template.id}`, { method: 'DELETE' }); setTemplates(await api('/email/templates')); })}>Delete</button>
              </div>
              <div className="slds-card__body slds-card__body_inner"><p><strong>{template.subject}</strong></p><p style={{ whiteSpace: 'pre-wrap' }}>{template.body}</p></div>
            </article>
          ))}
          <article className="slds-card">
            <div className="slds-card__body slds-card__body_inner">
              <h2 className="slds-text-heading_small">New template</h2>
              <input className="slds-input slds-m-bottom_x-small" placeholder="Name" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} />
              <input className="slds-input slds-m-bottom_x-small" placeholder="Subject" value={templateForm.subject} onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })} />
              <textarea className="slds-textarea" rows={5} placeholder="Body. Use {{name}} and {{accountName}}" value={templateForm.body} onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })} />
              <button className="slds-button slds-button_brand slds-m-top_small" onClick={() => guard(async () => { await api('/email/templates', { method: 'POST', body: templateForm }); setTemplates(await api('/email/templates')); setTemplateForm({ name: '', subject: '', body: '' }); })}>Save template</button>
              <p className="sf-muted slds-m-top_small">Inbound mail is logged with the Sync button after IMAP_* is configured. Outbound mail uses SMTP_*.</p>
              <button className="slds-button slds-button_neutral" onClick={() => guard(async () => { const result = await api('/email/sync', { method: 'POST' }); setError(result.message || `Imported ${result.imported} messages.`); })}>Sync inbound mail</button>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}
