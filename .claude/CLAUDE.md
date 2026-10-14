# Trash Day Reminder

## The Idea
Build a light notification to remind the trash-day, one day before. The source for the trash day comes from avalex.nl, for a given postal code and housenumber. The notification will be an IKEA RGB Zigbee lightbulb. We have it connected to the zigbee gateway Dirigera. Notification should be given the day before, on 7pm.  

## The application

This will be a web application that runs as a docker container.

Backend stack: nodejs
Frontend stack: react
Setup should be made as docker's volume

### Setup Page
For the first use, there's should be a setup page for the user.
This will first let the application discover the Dirigera, and let the user press the Action button to initiate pairing.
Then, user should enter the postal code and housenumber.
Then, user should choose the Ikea home automation's light, by entering the room name and the light name.
Then, the user should be able to test.

In case of the light is a RGB light:
- should light 'orange' for PMD afval
- should light 'blue' for Papier afval
- should light 'green' for Groen afval

In case the light capable for warm/cool white:
- PMD: warmest
- Papier: coolest
- Green: in between

In case not warm/cool white: just on/off

### Status Page
A status page which shows current month calendar on the left, and list of trash day on the right.
On the top, show the postal code and house number.
The Papier day will be circled blue, PMD gray, and GFT green.
Add the bottom, 'Dismiss' button, to dismiss notification.

### Functional Requirement
#### Notification
Notification should be given at 7pm the day before.
The data should be retrieved from avalex.nl, given the postal code and housenumber.
Make this source loosed coupled, since other region in NL can have different source.

#### Dismissal
Dimission in two ways:
- Timeout: 8am on the trash day
- Using a DELETE request (for external dismissal, or Status page)