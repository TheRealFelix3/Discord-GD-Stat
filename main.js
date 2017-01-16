/*
 * ISC License
 * Copyright (c) 2016, Nexrem
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

"use strict";
var Discordie = require("discordie"); // discord API
var fs = require("fs"); // Node filesystem
var express = require('express'); // require express API for network stuffs
var request = require('request'); // request API
var Jimp = require("jimp");

var client = new Discordie(); // creates new bot instance
var app = express(); // creates new express app instance

var port = process.env.PORT || 8080; // assign port. if no port given use localhost
initExpress(); // initializes express port listening


//////////////////////////////////// INIT //////////////////////////////////////

var config = JSON.parse(fs.readFileSync("./config.json", "utf8")); // parse config file
var colors = JSON.parse(fs.readFileSync("./resources/player/colors.json", "utf8")); // parse color storage file
var tracks = JSON.parse(fs.readFileSync("./resources/level/tracks.json", "utf8")); // parse audio tracks file
var icons = JSON.parse(fs.readFileSync("./resources/icons/icons.json", "utf8")); // parse icons

client.connect({
	token: config.token
}); // connects to the Discord servers using token.

// when the bot has connected succesfully and is receiving inputs.
client.Dispatcher.on("GATEWAY_READY", function(e) {

	console.log("Connected! " + client.User.username + " [" + client.User.id + "] ");
	client.User.setStatus("online", config.playing); // online, playing
	client.User.setUsername(config.name); // username
});

// ping self every 5 minutes
setInterval(function() {
	request.get(config["getTarget"]);
}, 300000);


//////////////////////////////// RUNTIME ///////////////////////////////////////

client.Dispatcher.on("MESSAGE_CREATE", function(e) {

	// checks if message starts with the command prefix.
	if (e.message.content.substring(0, config.command_prefix.length) == config.command_prefix) {
		let messageContent = e.message.content.substr(config.command_prefix.length); // remove the prefix from the message
		let messageCommand = messageContent.toLowerCase().split(" "); // split into array at space

		// check if user stats command
		if (messageCommand[0] == "stats" || messageCommand[0] == "player" || messageCommand[0] == "user") {

			// check if not blank
			if (messageCommand.length > 1) {
				let GD_user = messageContent.substr(messageCommand[0].length + 1); // remove command and empty space after it
				getUserStats(GD_user, e.message); // pass to poller
			} else {
				errorOut(5, e.message); // if blank error out
			};
		}
		// check if level stats command
		else if (messageCommand[0] == "level" || messageCommand[0] == "userlevel") {

			// check if not blank
			if (messageCommand.length > 1) {
				let GD_level = messageContent.substr(messageCommand[0].length + 1); // remove command and empty space after it
				getLevelStats(GD_level, e.message); // pass to poller
			} else {
				errorOut(6, e.message); // if blank error out
			};
		};
	};
});

///////////////////////////////////// MISC /////////////////////////////////////

// Use the search function to get ID
function getUserStats(GD_user, mseg) {

	//////////// FIRST REQUEST
	// post request to the boomlings server
	request.post({
			url: 'http://www.boomlings.com/database/getGJUsers20.php',
			form: {
				gameVersion: "20",
				binaryVersion: "30",
				str: GD_user,
				total: "0",
				page: "0",
				secret: "Wmfd2893gb7"
			}
		},
		// returns post data
		function(err, httpResponse, body) {
			// parses response data
			if (err) {
				console.log(err + "\n" + httpResponse);
				errorOut(1, mseg);
			} else if (body == "-1") {
				errorOut(0, mseg);
			} else {

				let objectArray = formatData(body.split("|")[0]);

				// Use the ID to get account info
				//////////// SECOND REQUEST
				// post request to the boomlings server
				request.post({
						url: 'http://www.boomlings.com/database/getGJUserInfo20.php',
						form: {
							gameVersion: "20",
							binaryVersion: "30",
							targetAccountID: objectArray["16"],
							secret: "Wmfd2893gb7"
						}
					},
					// returns post data
					function(err2, httpResponse2, body2) {
						// parses response data
						if (err2) {
							console.log(err2 + "\n" + httpResponse2);
							errorOut(1, mseg);
						} else if (body2 == "-1") {
							errorOut(0, mseg);
						} else {

							let objectArray = formatData(body2.split("|")[0]);

							// bind data values to variables
							let USERNAME = objectArray["1"];
							let USERID = objectArray["2"];
							let COINS = objectArray["13"];
							let USERCOINS = objectArray["17"];
							let COLOR1 = objectArray["10"];
							let COLOR2 = objectArray["11"];
							let STARS = objectArray["3"];
							let DEMONS = objectArray["4"];
							let CREATORPOINTS = objectArray["8"];
							let ACCOUNTID = objectArray["16"];
							let YOUTUBE = objectArray["20"];
							let ICON = objectArray["21"];
							let SHIP = objectArray["22"];
							let BALL = objectArray["23"];
							let UFO = objectArray["24"];
							let DART = objectArray["25"];
							let ROBOT = objectArray["26"];
							let GLOW = objectArray["28"];
							let SPIDER = objectArray["43"] || "0"; // or 0 if null data for pre 2.1
							let DIAMONDS = objectArray["46"] || "0";

							// display unknown for unknown icons and colors
							if (parseInt(ICON) > icons.icon) ICON = "unknown";
							if (parseInt(SHIP) > icons.ship) SHIP = "unknown";
							if (parseInt(BALL) > icons.ball) BALL = "unknown";
							if (parseInt(UFO) > icons.ufo) UFO = "unknown";
							if (parseInt(DART) > icons.wave) DART = "unknown";
							if (parseInt(ROBOT) > icons.robot) ROBOT = "unknown";
							if (parseInt(SPIDER) > icons.spider) SPIDER = "unknown";
							if (parseInt(COLOR1) > colors.count) COLOR1 = "0";
							if (parseInt(COLOR2) > colors.count) COLOR2 = "3";

							// fix log crashes
							let channelName = "PRIV_MESSAGE";
							let guildName = "PRIV_MESSAGE";
							if (mseg.guild != null || mseg.channel != null) {
								channelName = mseg.channel.name;
								guildName = mseg.guild.name;
							};

							// log
							console.log("User request by: " + mseg.author.username + " [" + mseg.author.id +
								"] || " + guildName + " [" + channelName + "] || [" + GD_user + "]"
							);

							// sends to card generator
							generatePlayerCard(mseg, ICON, SHIP, BALL, UFO, DART, ROBOT, SPIDER, COLOR1, COLOR2, GLOW, USERNAME, COINS, USERCOINS, STARS, DEMONS, CREATORPOINTS, DIAMONDS);

						};
					});
			};
		});
};

// gets level stats from server
function getLevelStats(GD_level, mseg) {

	//////////// FIRST REQUEST
	// post request to the boomlings server
	request.post({
			url: 'http://www.boomlings.com/database/getGJLevels21.php',
			form: {
				gameVersion: "20",
				binaryVersion: "30",
				str: GD_level,
				total: "0",
				page: "0",
				len: "-",
				type: "0",
				secret: "Wmfd2893gb7"
			}
		},
		// returns post data
		function(err, httpResponse, body) {
			// parses response data
			if (err) {
				console.log(err + "\n" + httpResponse);
				errorOut(1, mseg);
			} else if (body == "-1") {
				errorOut(3, mseg);
			} else {

				let objectArray = formatData(body.split("#")[0].split("|")[0])

				// objectArray binds
				let LEVELID = objectArray["1"]
				let LEVELNAME = objectArray["2"]
				let AUTHORID = objectArray["6"]
				let DIFFICULTY = objectArray["9"]
				let DOWNLOADS = objectArray["10"]
				let TRACKID = objectArray["12"]
				let LIKES = objectArray["14"]
				let DEMON = objectArray["17"]
				let AUTO = objectArray["25"]
				let STARS = objectArray["18"]
				let FEATURED = objectArray["19"]
				let z = new Buffer(objectArray["3"], 'base64')
				let LEVELDESC = z.toString()
				let LENGTH = objectArray["15"]
				let COINS = objectArray["37"]
				let SONGID = objectArray["35"]
				let FEATUREDCOINS = objectArray["38"]

				let AUTHORNAME = "(unknown)" // binds authorname to unknown in case nothing is returned
				let AUTHORARRAY = body.split("#")[1].split("|") // splits authors into an array

				// iterate through authors and search for a matching userID
				for (let i = 0; i < AUTHORARRAY.length; i++) {
					if (AUTHORARRAY[i].split(":")[0] == AUTHORID) {
						AUTHORNAME = AUTHORARRAY[i].split(":")[1]
						break;
					};
				};

				let SONGNAME = "(unknown)" // binds songname as unknown in case nothing returned
				let SONGAUTHOR = "(unknown)" // binds songauthor as unknown in case nothing is returned

				// check if official song. SONGID = 0. Else grab Newgrounds song
				if (SONGID == "0") {
					SONGNAME = tracks[TRACKID][0]
					SONGAUTHOR = tracks[TRACKID][1]
				} else {
					let SONGARRAY = body.split("#")[2].split(":") // splits songs into array for later use
					// iterate through songs and search for a matching songID
					for (let i = 0; i < SONGARRAY.length; i++) {
						if (SONGARRAY[i].split("~|~")[1] == SONGID) {
							SONGNAME = SONGARRAY[i].split("~|~")[3]
							SONGAUTHOR = SONGARRAY[i].split("~|~")[7]
							break; // break the loop if match
						};
					};
				};

				// fix log crashes
				let channelName = "PRIV_MESSAGE";
				let guildName = "PRIV_MESSAGE";
				if (mseg.guild != null || mseg.channel != null) {
					channelName = mseg.channel.name;
					guildName = mseg.guild.name;
				};

				// log
				console.log("Level request by: " + mseg.author.username + " [" + mseg.author.id +
					"] || " + guildName + " [" + channelName + "] || [" + GD_level + "]"
				);

				// send to card generator
				generateLevelCard(mseg, LEVELID, LEVELNAME, LEVELDESC, AUTHORNAME, DIFFICULTY, DOWNLOADS, LIKES, DEMON, AUTO, STARS, FEATURED, LENGTH, SONGID, COINS, FEATUREDCOINS, SONGNAME, SONGAUTHOR);
			};
		});
};

// player card generator function
function generatePlayerCard(mseg, ICON, SHIP, BALL, UFO, DART, ROBOT, SPIDER, COL1, COL2, GLOW, USERNAME, COINS, USERCOINS, STARS, DEMONS, CREATORPOINTS, DIAMONDS) {

	// reads all image data
	Jimp.read("./resources/player/skeleton-player.png", function(err0, skeletonPlayer) {
		Jimp.read("./resources/icons/icon/" + ICON + ".png", function(err1, icon) {
			Jimp.read("./resources/icons/ship/" + SHIP + ".png", function(err2, ship) {
				Jimp.read("./resources/icons/ball/" + BALL + ".png", function(err3, ball) {
					Jimp.read("./resources/icons/ufo/" + UFO + ".png", function(err4, ufo) {
						Jimp.read("./resources/icons/wave/" + DART + ".png", function(err5, wave) {
							Jimp.read("./resources/icons/robot/" + ROBOT + ".png", function(err6, robot) {
								Jimp.read("./resources/icons/spider/" + SPIDER + ".png", function(err7, spider) {
									Jimp.loadFont("./resources/bigFont.fnt", function(err8, font) {

										// error handling
										if (err0 || err1 || err2 || err3 || err4 || err5 || err6 || err7) {
											errorOut(2, mseg);
											console.log([err0, err1, err2, err3, err4, err5, err6, err7]);
											return; // stop function execution
										} else {

											// sends to recolor function and waits for callback. then rescales.
											reColor(icon, colors[COL1], colors[COL2]).resize(42, Jimp.AUTO);
											reColor(ship, colors[COL1], colors[COL2]).resize(46, Jimp.AUTO);
											reColor(ball, colors[COL1], colors[COL2]).resize(42, Jimp.AUTO);
											reColor(ufo, colors[COL1], colors[COL2]).resize(48, Jimp.AUTO);
											reColor(wave, colors[COL1], colors[COL2]).resize(32, Jimp.AUTO);
											reColor(robot, colors[COL1], colors[COL2]).resize(38, Jimp.AUTO);
											reColor(spider, colors[COL1], colors[COL2]).resize(48, Jimp.AUTO);

											// if glow add glow
											if (GLOW == "1") {
												icon = addGlow(icon, COL1, COL2); // rebind after recolor
												ship = addGlow(ship, COL1, COL2);
												ball = addGlow(ball, COL1, COL2);
												ufo = addGlow(ufo, COL1, COL2);
												wave = addGlow(wave, COL1, COL2);
												robot = addGlow(robot, COL1, COL2);
												spider = addGlow(spider, COL1, COL2);
											}

											let outputfile = "./output/" + Math.random().toString(36).substr(2, 5) + ".png" // create a random name for the output file

											//  overlay the changed drawables on top of our base.
											skeletonPlayer
												.composite(icon, 40, 64)
												.composite(ship, 98, 70)
												.composite(ball, 158, 64)
												.composite(ufo, 216, 75)
												.composite(wave, 282, 64)
												.composite(robot, 333, 64)
												.composite(spider, 385, 68)
												.print(font, 2, 2, USERNAME, 478, Jimp.ALIGN_FONT_CENTER) // print some text with a custom font.
												.print(font, 75, 117, STARS)
												.print(font, 246, 117, USERCOINS)
												.print(font, 393, 117, COINS)
												.print(font, 75, 156, DIAMONDS)
												.print(font, 246, 156, DEMONS)
												.print(font, 393, 156, CREATORPOINTS)
												// write file
												.write(outputfile, function() {
													// upload file
													mseg.channel.uploadFile(outputfile).then(function() {
														// delete file
														fs.unlink(outputfile);
														console.log("SUCCESS: " + USERNAME);
													});
												});
										};
									});
								});
							});
						});
					});
				});
			});
		});
	});
}

var levelLengths = ["Tiny", "Short", "Medium", "Long", "XL"] // Array containing level lenght values

function generateLevelCard(mseg, LEVELID, LEVELNAME, LEVELDESC, AUTHORNAME, DIFFICULTY, DOWNLOADS, LIKES, DEMON, AUTO, STARS, FEATURED, LENGTH, SONGID, COINS, FEATUREDCOINS, SONGNAME, SONGAUTHOR) {

	// load in all fonts and images we need
	Jimp.loadFont("./resources/bigFont.fnt", function(err0, bigFont) {
		Jimp.loadFont("./resources/bigFont-hd.fnt", function(err1, bigFontHD) {
			Jimp.loadFont("./resources/bigFont-yellow.fnt", function(err2, bigFontYellow) {
				Jimp.loadFont(Jimp.FONT_SANS_32_WHITE, function(err3, descriptionFont) {
					Jimp.read("./resources/level/skeleton-level.png", function(err4, skeletonLevel) {
						Jimp.read("./resources/level/difficulties.png", function(err5, difficulties) {
							Jimp.read("./resources/level/levelCoins.png", function(err6, levelCoins) {

								// error handling
								if (err0 || err1 || err2 || err3 || err4 || err5 || err6) {
									errorOut(2, mseg);
									console.log([err0, err1, err2, err3, err4, err5, err6]);
									return; // stop function execution
								} else {

									let outputfile = "./output/" + Math.random().toString(36).substr(2, 5) + ".png" // create a random name for the output file

									// Difficulty handler
									if (DEMON == "1") {
										difficulties.crop(0, 517, 86, 86); // if demon use demon
									} else if (AUTO == "1") {
										difficulties.crop(0, 604, 86, 86); // if auto use auto
									} else {
										difficulties.crop(0, (parseInt(DIFFICULTY) / 10) * 86, 86, 86); // else use other
									};

									// coins handler
									if (FEATUREDCOINS == "1") {
										levelCoins.crop(0, 0, 41, 41); // if featured coin use apropriate image
									} else {
										levelCoins.crop(0, 41, 41, 41); // if not use other image
									};
									// draw X ammount of coins
									for (let i = 0; i < parseInt(COINS); i++) {
										if (i > 2) {
											break;
										} // break if too much coins
										skeletonLevel.composite(levelCoins, 425 + (i * 25), 95);
									}

									// featured handler
									if (parseInt(FEATURED) > 0) {
										skeletonLevel.print(bigFontYellow, 655, 58, STARS); // if featured draw the stars count in yellow
									} else {
										skeletonLevel.print(bigFont, 655, 58, STARS); // if not in white
									}

									// composes image
									skeletonLevel
										.print(bigFontHD, 10, -6, LEVELNAME)
										.print(bigFontYellow, 10, 50, "by " + AUTHORNAME)
										.print(bigFont, 5, 113, LEVELID)
										.print(bigFont, 235, 80, LIKES)
										.print(bigFont, 235, 114, DOWNLOADS)
										.print(bigFont, 655, 103, levelLengths[parseInt(LENGTH)])
										.print(descriptionFont, 48, 155, LEVELDESC, 790)
										.print(bigFont, 55, 325, SONGNAME)
										.print(bigFontYellow, 55, 360, "by " + SONGAUTHOR)
										.composite(difficulties, 525, 58)
										// write file
										.write(outputfile, function() {
											// upload file
											mseg.channel.uploadFile(outputfile).then(function() {
												// delete file
												fs.unlink(outputfile);
												console.log("SUCCESS: " + LEVELNAME + "[" + LEVELID + "]")
											});
										});
								};
							});
						});
					});
				});
			});
		});
	});
};

//////////////////////////////////////////////////////
// primary color variables
var primaryR = 175
var primaryG = 175
var primaryB = 175
var primaryFlux = 61
// secondary color variables
var secondaryR = 255
var secondaryG = 255
var secondaryB = 255
var secondaryFlux = 180

// icon re-color function
function reColor(drawable, COL1, COL2) {

	drawable.scan(0, 0, drawable.bitmap.width, drawable.bitmap.height, function(x, y, idx) {
		// x, y is the position of this pixel on the image
		// idx is the position start position of this rgba tuple in the bitmap Buffer
		// this is the image
		if ((this.bitmap.data[idx] >= primaryFlux && this.bitmap.data[idx] <= primaryR) && (this.bitmap.data[idx + 1] >= primaryFlux && this.bitmap.data[idx + 1] <= primaryG) && (this.bitmap.data[idx + 2] >= primaryFlux && this.bitmap.data[idx + 2] <= primaryB)) {
			this.bitmap.data[idx] = COL1[0] / (primaryR / this.bitmap.data[idx]);
			this.bitmap.data[idx + 1] = COL1[1] / (primaryG / this.bitmap.data[idx + 1]); // calculation to fix shading
			this.bitmap.data[idx + 2] = COL1[2] / (primaryB / this.bitmap.data[idx + 2]);
			// check if pixel is between certain ranges. If yes execute code
		} else if ((this.bitmap.data[idx] >= secondaryFlux && this.bitmap.data[idx] <= secondaryR) && (this.bitmap.data[idx + 1] >= secondaryFlux && this.bitmap.data[idx + 1] <= secondaryG) && (this.bitmap.data[idx + 2] >= secondaryFlux && this.bitmap.data[idx + 2] <= secondaryB)) {
			this.bitmap.data[idx] = COL2[0] / (secondaryR / this.bitmap.data[idx]);
			this.bitmap.data[idx + 1] = COL2[1] / (secondaryG / this.bitmap.data[idx + 1]); // calculation to fix shading
			this.bitmap.data[idx + 2] = COL2[2] / (secondaryB / this.bitmap.data[idx + 2]);
		};
	});

	return drawable // returns the edited drawable
}

var glowWidth = 4 // the width of the glow in pixels

// give the image a glow outline
function addGlow(drawable, COL1, COL2) {

	// if both colors are black outline is white
	if (COL1 == "15" && COL2 == "15") {
		COL2 = "12"
	}
	// if primary secondary color is black use primary
	else if (COL2 == "15") {
		COL2 = COL1
	}

	// create new image and add the glow width to height and width
	var output = new Jimp(drawable.bitmap.width + glowWidth, drawable.bitmap.height + glowWidth, function(err, output) {

		output
			.composite(drawable, glowWidth / 2, glowWidth / 2) //place the original drawable in the middle
			.blur(glowWidth / 4) //blur it (fast blur)

			// iterate through all pixels
			.scan(0, 0, output.bitmap.width, output.bitmap.height, function(x, y, idx) {

				var alpha = this.bitmap.data[idx + 3]; // get alpha

				// if alpha is more than 10 (0-255)
				if (alpha > 10) {
					this.bitmap.data[idx + 0] = colors[COL2][0]; //replace pixel with color secondary color
					this.bitmap.data[idx + 1] = colors[COL2][1];
					this.bitmap.data[idx + 2] = colors[COL2][2];
					this.bitmap.data[idx + 3] = 255; //make pixel fuly opaque
				}
			})
			.composite(drawable, glowWidth / 2, glowWidth / 2); // place original image over edited one.
	});
	return output; // return edited
}

// parse the output data from the server
function formatData(data) {
	// Generate object from request
	let array = data.split(":") // split body into array
	let objectArray = {} // blank object
	// iterate through array and add to object
	for (let i = 0; i < array.length; i = i + 2) {
		objectArray[array[i]] = array[i + 1]
	}
	return objectArray
}

// error list
var errorString = {
	"0": "Database Error! [ USER NOT FOUND ]",
	"1": "Communication Error! [ SEE LOG ]",
	"2": "SYSTEM ERROR [ SEE LOG ]",
	"3": "Database Error! [ LEVEL NOT FOUND ]",
	"4": "Unknown Error! [ SEE LOG ]",
	"5": "USAGE `" + config.command_prefix + "stats <USERNAME>`",
	"6": "USAGE `" + config.command_prefix + "level <NAME OR ID>`"
};

// error printer
function errorOut(num, mseg) {
	if (num != null && errorString[num.toString()] != undefined) {
		mseg.channel.sendMessage(errorString[num.toString()]);
	} else {
		mseg.channel.sendMessage(errorString["4"]);
	};
};

// Express lib is used to respond to the heroku server and prevent from automatic close
function initExpress() {

	//listen on port.
	app.listen(port, function() {
		console.log('Our app is running on http://localhost:' + port); // respond on port
	});

	app.use(express.static(__dirname + '/public')); // to be able to use static content in /public directory. Such as HTML files and etc.
};
