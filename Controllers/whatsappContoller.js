const { matchedData } = require("express-validator");
const { sendError } = require("../utils/responseStatus");
const { handleValidationErrors } = require("../utils/helper");
const {getRecommendedStoriesService} = require('../services/whatsappService');

const getRecommendedStories = async(req,res)=>{
    try {
        if (handleValidationErrors(req, res)) return;
        const {profile_id} = matchedData(req);

        const recommendedStories = await getRecommendedStoriesService(profile_id);

        return res.status(200).json({ stories: recommendedStories });

    } catch (error) {
        console.log(error);
        return sendError(res)
        
    }
}

exports.getRecommendedStories = getRecommendedStories;