/**
 * Grant the MBW admin account access to every enforced sheet/range
 * protection. File-level sharing is managed in the spreadsheet Share dialog
 * so this script does not request broad Google Drive authorization.
 *
 * Run as mindobirdwatching@gmail.com, the spreadsheet owner.
 */
function configureMbwAccountingAccess() {
  var spreadsheetId = MBW_SYNC_SPREADSHEET_ID;
  var adminEmail = 'admin@mindobirdwatching.com';
  var expectedOwner = 'mindobirdwatching@gmail.com';
  var executor = Session.getEffectiveUser().getEmail();

  if (executor.toLowerCase() !== expectedOwner) {
    throw new Error(
      'Run configureMbwAccountingAccess as ' + expectedOwner +
      '; current executor is ' + (executor || '(unknown)')
    );
  }

  var ss = SpreadsheetApp.openById(spreadsheetId);
  var protections = ss.getProtections(SpreadsheetApp.ProtectionType.SHEET)
    .concat(ss.getProtections(SpreadsheetApp.ProtectionType.RANGE));
  var updated = 0;
  var alreadyAllowed = 0;
  var warningOnly = 0;

  protections.forEach(function (protection) {
    if (protection.isWarningOnly()) {
      warningOnly += 1;
      return;
    }

    var editorEmails = protection.getEditors().map(function (user) {
      return String(user.getEmail() || '').toLowerCase();
    });

    if (editorEmails.indexOf(adminEmail) === -1) {
      protection.addEditor(adminEmail);
      updated += 1;
    } else {
      alreadyAllowed += 1;
    }
  });

  return auditMbwAccountingAccess_({
    updated_protections: updated,
    already_allowed_protections: alreadyAllowed,
    warning_only_protections: warningOnly
  });
}

/** Read-only verification for protection editors. */
function auditMbwAccountingAccess() {
  return auditMbwAccountingAccess_({});
}

function auditMbwAccountingAccess_(context) {
  var spreadsheetId = MBW_SYNC_SPREADSHEET_ID;
  var adminEmail = 'admin@mindobirdwatching.com';
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var protections = ss.getProtections(SpreadsheetApp.ProtectionType.SHEET)
    .concat(ss.getProtections(SpreadsheetApp.ProtectionType.RANGE));
  var enforced = 0;
  var missingAdmin = [];

  protections.forEach(function (protection) {
    if (protection.isWarningOnly()) return;
    enforced += 1;

    var editorEmails = protection.getEditors().map(function (user) {
      return String(user.getEmail() || '').toLowerCase();
    });
    if (editorEmails.indexOf(adminEmail) === -1) {
      missingAdmin.push({
        type: String(protection.getRange ? 'range_or_sheet' : 'protection'),
        description: protection.getDescription() || ''
      });
    }
  });

  var result = Object.assign({}, context || {}, {
    ok: missingAdmin.length === 0,
    executor: Session.getEffectiveUser().getEmail(),
    protection_count: protections.length,
    enforced_protection_count: enforced,
    missing_admin_protection_count: missingAdmin.length,
    missing_admin_protections: missingAdmin
  });

  console.log(JSON.stringify(result));
  return result;
}
