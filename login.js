var message = function(result) {
    return {
        "html": "<p>Hello " + result.merge_fields.NAME + ",</p><p><a href='http://ludnat.wendzich.com/?token=" + result.unique_email_id + "&email=" + result.email_address + "'>See your invitation to our wedding.</a></p><p>Cheers,<br>Natalie and Ludwig.</p>",
        "subject": "Invitation to Natalie and Ludwig’s Wedding",
        "from_email": "ludwig@wendzich.com",
        "from_name": "Ludwig Wendzich",
        "auto_text": true,
        "to": [{
                "email": result.email_address,
                "name": result.merge_fields.NAME,
                "type": "to"
            }],
        "headers": {
            "Reply-To": "ludwig@wendzich.com"
        },
        "important": false,
        "track_opens": true,
        "track_clicks": true,
        "url_strip_qs": false,
        "preserve_recipients": null,
        "view_content_link": true,
        "tracking_domain": null,
        "signing_domain": null,
        "return_path_domain": null
    };
};
module.exports = message;
