// utils/timestampHook.js
function timestampHook(fields) {
  return {
    beforeCreate: (instance) => {
      fields.forEach((field) => {
        instance[field] = Date.now();
      });
    },
    beforeUpdate: (instance) => {
      fields.forEach((field) => {
        if (field === 'updated_at' || field === 'updated_on') {
          instance[field] = Date.now();
        }
      });
    },

    beforeBulkUpdate: (options) => {
      if (!options.attributes) return;

      if (fields.includes('updated_at')) {
        options.attributes.updated_at = Date.now();
      }
      if (fields.includes('updated_on')) {
        options.attributes.updated_on = Date.now();
      }
      if (fields.includes('otp_creation_time')) {
        options.attributes.otp_creation_time = Date.now();
      }
      if(fields.includes('last_resend_otp_time')){
        options.attributes.last_resend_otp_time = Date.now();
      }
    }
  };
}

module.exports = timestampHook;
