# node-troue

A CampaignMonitor List backed RSVP app that runs on Node in Heroku.

This app [used to be](https://github.com/ludwigw/node-troue/commit/7872fae83ef21c1875d7b004472581345448418b) backed by Mailchimp, but [Mailchimp don’t want you using their service for weddings](http://ludwig.nz/2017/06/23/dont-use-mailchimp-for-weddings/) so it uses CampaignMonitor now, instead.

## Running Locally

Make sure you have the following file, `env.sh`:

```sh
export CREATESEND_KEY=<CM-API-KEY>
export CREATESEND_LIST=<CM-LIST-ID>
export CREATESEND_CLIENT=<CM-CLIENT-ID>
export CREATESEND_EMAIL_LOGIN=<CM-SMARTEMAILID-FOR-LOST-LINKS>
export CREATESEND_EMAIL_NOTIFY=<CM-SMARTEMAILID-FOR-NOTIFICATIONS>

export RSVP_NOTIFY_IGNOREADMIN=false
export RSVP_BASEURL=http://ludnat.wendzich.com
```

```sh
$ source env.sh
$ npm install
$ npm start
```

Your app should now be running on [localhost:5000](http://localhost:5000/).

## Deploying to Heroku

Setup the above ENV variables on Heroku.

```
$ git push heroku master
$ heroku open
```
or

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy)

## Setting up Campaign Monitor

1. Create a list with Custom Fields:
	1. `Token` _Text_: This can be manually populated, or automatically populated with secure tokens if you visit: `/tokenize`
	2. `RSVP` _Number_: Status of the RSVP
		- `0`: Waiting for response, `1`: Sends regrets, `2`: Coming.
	3. `Dietary` _Text_: Will be populated from the invitation page when guests RSVP.
	5. `Count` _Number_: How many people are on the invitation.
2. Webhooks will automatically be created to send notifications to your Team Members and Admins.
	1. Manage notifications on `/list?token=<CM-API-KEY>`
	2. Admins are automatically included, you can make sure they are excluded by setting the environment variable `RSVP_NOTIFY_IGNOREADMIN` to `true`.
3. You must create 2 Smart Emails:
	1. **Login Email**. An email for when people lose their invitation URL and request it to be sent to them from the homepage.
		- This can use the custom personalization tags: `[Token]` and `[email]`, specifically for the Login URL: `/?token=[Token]&email=[email]`.
	2. **Notify Email**. A notification email for when people RSVP to be sent to the Team Members (and Admins).
		- This can use the custom personalization tags: `[Token]`, `[Name]`, `[email]`, `[Count]`, `[RSVP]` and `[Dietary]`.

## Using the app.

1. Create your invitation list. Leave the `RSVP` and `Dietary` fields blank, these will be updated by the app. Make sure `Count` is filled out for each Subscriber.
1. View RSVPs and manage notification settings at: `/list?token=<CM-API-KEY>`.
1. Send out RSVPs that include a login link to RSVP: `/?token=[Token]&email=[email]`.
