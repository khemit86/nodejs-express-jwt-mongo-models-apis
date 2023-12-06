const EmailTemplate = require("../../models/emailtemplate.model");
const Country = require("../../models/countries.model");
var { isEmpty } = require("lodash");
const { responseData } = require("../../helpers/responseData");
const _ = require("lodash");
const setting_service = require("./setting.services");
const util = require("util");
const { Types } = require("mongoose");
var fs = require("fs");
const readFile = util.promisify(fs.readFile);
const { addLog } = require("../../helpers/helper");
var moment = require("moment");
var momentTz = require("moment-timezone");

module.exports = {
  add_email: async (req, res) => {
    try {
      const {
        title,
        subject,
        description,
        country_id,
        globalHeader,
        globalFooter,
      } = req.body;


      const all_country = await Country.find({}, { _id: 1 });
      for(let item=0; item<all_country.length; item++) {
        await EmailTemplate.create({
          title,
          subject,
          description,
          country_id: all_country[item]?._id,
          globalHeader,
          globalFooter,
        });
      }
      // if (!isEmpty(email)) {
        return res.json(responseData("EMAIL_TEMPLATE_ADDED", {}, req, true));
      // } else {
      //   return res.json(responseData("ERROR_OCCUR", {}, req, false));
      // }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  delete_email: async (req, res) => {
    try {
      const email = await EmailTemplate.findOneAndRemove({
        _id: req.params.id,
      });
      if (!isEmpty(email)) {
        return res.json(responseData("EMAIL_TEMPLATE_DELETED", {}, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  list_email: async (req, res) => {
    try {
      let {
        page,
        limit,
        status,
        sort_by,
        keyword,
        country_id,
        sort_type,
        start_date,
        end_date,
        timezone,
      } = req.query;
      keyword = _.trim(keyword);
      const sortOptions = {
        [sort_by || "created_at"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };
      console.log(sortOptions);
      var match = {};
      if (status) {
        if (status == 1) {
          match.status = true;
        } else if (status == 0) {
          match.status = false;
        }
      }

      if (start_date) {
        start_date = new Date(
          momentTz
            .tz(start_date + " 00:00:00", timezone)
            .utc()
            .toISOString()
        );
      }
      if (end_date) {
        end_date = new Date(
          momentTz
            .tz(end_date + " 23:59:59", timezone)
            .utc()
            .toISOString()
        );
      }

      if (start_date && end_date) {
        match.createdAt = {
          $gte: start_date,
          $lte: end_date,
        };
      } else if (start_date && !end_date) {
        match.createdAt = {
          $gte: start_date,
        };
      } else if (!start_date && end_date) {
        match.createdAt = {
          $lte: end_date,
        };
      }
      
      if (country_id) {
        match.country_id = Types.ObjectId(country_id);
      }

      if (keyword) {
        match["$or"] = [
          { title: { $regex: keyword, $options: "i" } },
          { subject: { $regex: keyword, $options: "i" } },
          //{ description: { $regex: keyword, $options: "i" } },
          //{ "country.name": { $regex: keyword, $options: "i" } },
        ];
      }

      const query = EmailTemplate.aggregate([
        {
          $lookup: {
            from: "countries",
            localField: "country_id",
            foreignField: "_id",
            as: "country",
          },
        },
        {
          $unwind: {
            path: "$country",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: match,
        },
        {
          $project: {
            _id: 1,
            title: 1,
            subject: 1,
            description: 1,
            "country._id": { $ifNull: ["$country._id", ""] },
            "country.name": { $ifNull: ["$country.name", ""] },
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            __v: 1,
            globalHeader: 1,
            globalFooter: 1,
            slug: 1,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await EmailTemplate.aggregatePaginate(query, options);
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  edit_email: async (req, res) => {
    try {
      const { _id, title, subject, description, globalHeader, globalFooter } =
        req.body;

      let emailExist = await EmailTemplate.findById(_id);

      const serviceValue = {};
      if (title) serviceValue.title = title;
      if (subject) serviceValue.subject = subject;
      if (description) serviceValue.description = description;
      if (globalHeader) serviceValue.globalHeader = globalHeader;
      if (globalFooter) serviceValue.globalFooter = globalFooter;

      var emailOld = await EmailTemplate.findOne({
        _id: { $eq: _id },
      });

      const email = await EmailTemplate.findByIdAndUpdate(
        { _id },
        serviceValue,
        { new: true }
      );
      let logMessage = "";
      if (email.subject != emailOld.subject) {
        logMessage +=
          " </br> Subject :   " + emailOld.subject + " to " + email.subject;
      }
      if (email.description != emailOld.description) {
        logMessage +=
          " </br> Description :   " +
          emailOld.description +
          " to " +
          email.description;
      }
      if (logMessage != "") {
        addLog(
          req.user._id,
          "Email Updated",
          email.title,
          logMessage,
          email._id
        );
      }
      if (!isEmpty(email)) {
        return res.json(
          responseData("EMAIL_TEMPLATE_UPDATED", email, req, true)
        );
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  change_status_email: async (req, res) => {
    try {
      const { id } = req.params;
      const emailDetail = await EmailTemplate.findOne({ _id: id });
      let status = emailDetail?.status == 1 ? 0 : 1;
      const email = await EmailTemplate.findOneAndUpdate(
        { _id: id },
        { status },
        { new: true }
      );
      if (!isEmpty(email)) {
        return res.json(
          responseData("EMAIL_TEMPLATE_STATUS_UPDATED", email, req, true)
        );
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  getEmailTemplateBySlugAndCountry: async (slug, country_id) => {
    try {
      const emailDetail = await EmailTemplate.findOne({
        slug: slug,
        country_id: country_id,
      });

      var settingsDetail = await setting_service.getSettingsRow(country_id);

      var layoutDetails = await readFile("email_layouts/general.html", "utf8");

      var header = "";
      var footer = "";

      if (emailDetail.globalHeader == true) {
        header = settingsDetail.email_header;
      }
      if (emailDetail.globalFooter == true) {
        footer = settingsDetail.email_footer;
      }
      layoutDetails = _.replace(
        layoutDetails,
        "[LayoutContent]",
        emailDetail.description
      );
      layoutDetails = _.replace(layoutDetails, "[Header]", header);
      layoutDetails = _.replace(layoutDetails, "[Footer]", footer);
      return { description: layoutDetails, subject: emailDetail.subject };
    } catch (err) {
      return err;
    }
  },
};
