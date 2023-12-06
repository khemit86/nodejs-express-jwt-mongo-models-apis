const HomeScreen = require("../../models/homescreen.model");
var { isEmpty } = require("lodash");
const { responseData } = require("../../helpers/responseData");
const { addLog } = require("../../helpers/helper");
var momentTz = require("moment-timezone");
const _ = require("lodash");
const { Types } = require("mongoose");
const {
  HOME_FOLDER,
  HOME_THUMB_HEIGHT,
  HOME_THUMB_WIDTH,
} = require("../../helpers/config");
const { saveFile, saveThumbFile } = require("../../helpers/helper");

module.exports = {
  add_home_image: async (req, res) => {
    try {
      const { type, description,country_id } = req.body;
      // if(type==1 ){
      //   var valid = /^(ftp|http|https):\/\/[^ "]+$/.test(description);
      //   if(valid==false){
      //     return res.json(responseData("Url is not correct", {}, req, false));
      //   }
      // }
      // uploadImageStart
      var image = "";
      const files = req.files;
      if (files && files.image) {
        const data = files.image;
        if (data.name) {
          if (files && files.image.name != undefined) {
            image = await saveFile(files.image, HOME_FOLDER, null);
            await saveThumbFile(
              files.image,
              HOME_FOLDER,
              null,
              image,
              HOME_THUMB_WIDTH,
              HOME_THUMB_HEIGHT,
              `public/${HOME_FOLDER}/thumb`
            );
          }
        }
      }else{
        return res.json(responseData("Image is required", {}, req, false));
      }
      // uploadImageEnd
      const home = await HomeScreen.create({ country_id,type, image });
      
      if (!isEmpty(home)) {
        return res.json(responseData("HOME_ADDED", home, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  
  list_home_image: async (req, res) => {
    try {
      let { page, limit, status, sort_by, keyword, country_id, sort_type,type,start_date,end_date ,timezone} =
        req.query;
        
      keyword = _.trim(keyword);
      const sortOptions = {
        [sort_by || "created_at"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };

      var match = {};
      if (status) {
        if (status == 1) {
          match.status = true;
        } else if (status == 0) {
          match.status = false;
        }
      }

      if (country_id) {
        match.country_id = Types.ObjectId(country_id);
      }
      if (type==1) {
        match.type = 1;
      }else{
        match.type = 2;
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
      

      const query = HomeScreen.aggregate([
        {
          $lookup: {
            from: "countries",
            localField: "country_id",
            foreignField: "_id",
            as: "country",
          },
        },
        {
          $unwind: "$country",
        },
        {
          $match: match,
        },
        {
          $project: {
            _id: 1,
            description: 1,
            type: 1,
            image: 1,
            "country._id": 1,
            "country.name": 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            __v: 1,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await HomeScreen.aggregatePaginate(query, options);
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  edit_home_image: async (req, res) => {
    try {
      const {description,type,status,banner_id } = req.body;
      

      console.log('bannerId:',banner_id);
      // if(type==1 ){
      //   var valid = /^(ftp|http|https):\/\/[^ "]+$/.test(description);
      //   if(valid==false){
      //     return res.json(responseData("Url is not correct", {}, req, false));
      //   }
      // }

      var brandOld = await HomeScreen.findOne({
        _id: { $eq: Types.ObjectId(banner_id) },
      });

      // uploadImageStart
      var image = "";
      const files = req.files;
      if (files && files.image) {
        const data = files.image;
        if (data.name) {
          if (files && files.image.name != undefined) {
            image = await saveFile(files.image, HOME_FOLDER, brandOld.image);
            await saveThumbFile(
              files.image,
              HOME_FOLDER,
              brandOld.image,
              image,
              HOME_THUMB_WIDTH,
              HOME_THUMB_HEIGHT,
              `public/${HOME_FOLDER}/thumb`
            );
          }
        }
      }
      // uploadImageEnd
      const serviceValue = {};
      serviceValue.type=type;
      serviceValue.description=description;
      if (image) serviceValue.image = image;
      const _id =Types.ObjectId(banner_id)
      const home = await HomeScreen.findByIdAndUpdate({ _id }, serviceValue, {
        new: true,
      });
      
      if (!isEmpty(home)) {
        return res.json(responseData("BANNER_IMAGE_UPDATED", home, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  home_screen_manager_status_change: async (req, res) => {
    try {
      const { status } = req.body;
      
      const resp = await HomeScreen.findOneAndUpdate(
        { _id: req.params.id },
        { $set: { status } },{new: true}
      );

      
      if (resp._id) {
        let alert_msg_sub = "STATUS_UPDATED";
        // if(resp.role_id==2){
        //   alert_msg_sub = "COUNTRY_STATUS_UPDATE";
        // }else if(resp.role_id==3){
        //   alert_msg_sub = "CITY_STATUS_UPDATE";
        // }else if(resp.role_id==4){
        //   alert_msg_sub = "STORE_STATUS_UPDATE";
        // }
        return res.json(responseData(alert_msg_sub, {}, req, true));
      } else {

        let alert_msg_sub = "HOME_SCREEN_MANAGER_NOT_FOUND";
        // if(resp.role_id==2){
        //   alert_msg_sub = "COUNTRY_NOT_FOUND";
        // }else if(resp.role_id==3){
        //   alert_msg_sub = "CITY_NOT_FOUND";
        // }else if(resp.role_id==4){
        //   alert_msg_sub = "STORE_NOT_FOUND";
        // }
        return res.json(responseData(alert_msg_sub, {}, req, false));
      }
    } catch (error) {
      
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
 
};
