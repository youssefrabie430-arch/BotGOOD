const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const noblox = require('noblox.js');
const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const pricePerRobux = 0.30; // ده سعر الروبكس الواحد بالجنيه
const cryptoRate = 0.006;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const prefix = '-';
const token = process.env.TOKEN;
const cookie = process.env.COOKIE;
const ownerId = '773062256702259211';

let pricePerUnit = 550000; // ده السعر، غيره زي ما تحب

async function getRobloxUser(cookieStr) {
    const response = await axios.get('https://users.roblox.com/v1/users/authenticated', {
        headers: { 'Cookie': `.ROBLOSECURITY=${cookieStr}` }
    });
    return response.data;
}

async function buyGamepassDirect(cookieStr, productId, expectedPrice, sellerId) {
    let csrfToken = '';
    try {
        await axios.post('https://auth.roblox.com/v2/login', {}, {
            headers: { 'Cookie': `.ROBLOSECURITY=${cookieStr}` }
        });
    } catch (error) {
        csrfToken = error.response?.headers['x-csrf-token'];
    }
    if (!csrfToken) throw new Error('فشل جلب توكن الحماية X-CSRF-Token');
    const buyResponse = await axios.post(
        `https://economy.roblox.com/v1/purchases/products/${productId}`,
        {
            expectedCurrency: 1,
            expectedPrice: parseInt(expectedPrice),
            expectedSellerId: parseInt(sellerId)
        },
        {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookieStr}`,
                'X-CSRF-TOKEN': csrfToken,
                'Content-Type': 'application/json'
            }
        }
    );
    return buyResponse.data;
}

async function createRobloxInvoice(gamepassName, robloxUsername, price, gamepassId) {
    const canvas = createCanvas(960, 395);
    const ctx = canvas.getContext('2d');

    // الخلفيات
    ctx.fillStyle = '#0b0c0d'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#191b1d'; ctx.fillRect(0, 0, 325, canvas.height);

       // محاولة جلب الصورة الحقيقية للجيم باس من الـ API العام لروبلوكس
    let imageLoaded = false;
    try {
        const thumbResponse = await axios.get(`https://thumbnails.roblox.com/v1/game-passes?gamePassIds=${gamepassId}&size=150x150&format=Png&isCircular=false`);
        const imageUrl = thumbResponse.data?.data?.[0]?.imageUrl;
        
        if (imageUrl && !imageUrl.includes('no-image') && !imageUrl.includes('icon-placeholder')) {
            const img = await loadImage(imageUrl);
            ctx.drawImage(img, boxX, boxY, boxSize, boxSize);
            imageLoaded = true;
        }
    } catch (err) {
        console.log("ℹ️ لم يتم العثور على صورة مخصصة، سيتم رسم التذكرة الافتراضية.");
    }

    // إذا لم تكن هناك صورة مخصصة -> ارسم التذكرة الرمادية بدقة عالية
    if (!imageLoaded) {
        ctx.save();
        ctx.translate(170, 170); 
        ctx.rotate(-25 * Math.PI / 180); 
        ctx.fillStyle = '#55585c';
        ctx.fillRect(-65, -35, 130, 70); 
        
        ctx.fillStyle = '#252729';
        ctx.beginPath(); ctx.arc(-65, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(65, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    
    // النصوص
    const robloxFont = '600 23px "Gotham SSm", Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px Arial, sans-serif';
    ctx.fillText(gamepassName, 365, 78);

    ctx.fillStyle = '#ffffff';
    ctx.font = robloxFont;
    ctx.fillText('By ', 365, 134);
    
    // هنا بيتحط اسم الروبلوكس اللي هتبعتله للدالة
    const byWidth = ctx.measureText('By ').width;
    ctx.fillText(`@${robloxUsername}`, 365 + byWidth, 134);

    const nameWidth = ctx.measureText(`@${robloxUsername}`).width;
    const checkX = 365 + byWidth + nameWidth + 10;

    // علامة الصح
    ctx.fillStyle = '#00b06f';
    ctx.beginPath(); ctx.arc(checkX + 11, 126, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(checkX + 7, 126); ctx.lineTo(checkX + 10, 129); ctx.lineTo(checkX + 15, 121); ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillText('Item Owned', checkX + 30, 134);

    // الخطوط والأزرار
    ctx.strokeStyle = '#202224'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(365, 172); ctx.lineTo(920, 172); ctx.stroke();
    
    // --- التعديل هنا ---
ctx.fillStyle = '#ffffff';
ctx.font = '500 18px Arial'; 
const textMaxWidth = 380; // خليناها 380 عشان نبعد أكتر عن الزر
ctx.fillText('This item is available in your inventory.', 365, 222, textMaxWidth);
    ctx.fillStyle = '#2b2d30'; ctx.beginPath(); ctx.roundRect(775, 190, 145, 44, 6); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 18px Arial';
    ctx.fillText('Inventory', 806, 218);

    // الجدول
    ctx.fillStyle = '#656668'; ctx.font = '500 21px Arial';
    ctx.fillText('Price', 365, 290);
    ctx.fillText('Type', 365, 335);
    ctx.fillText('Created', 365, 380);

    ctx.fillStyle = '#ffffff';
    ctx.fillText('Pass', 500, 335);
    ctx.fillText(new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }), 500, 380);

    // السعر (تأكد أن دالة drawRobuxIcon موجودة في ملفك خارج هذه الدالة)
    if (typeof drawRobuxIcon === 'function') {
        drawRobuxIcon(ctx, 500, 291, 22);
    }
    ctx.font = 'bold 24px Arial';
    ctx.fillText(String(price), 522, 291);

    return canvas.toBuffer();
}

client.once('ready', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}!`);
    try {
        await noblox.setCookie(cookie);
        console.log(`✅ Connected to Roblox Account!`);
    } catch (error) {
        console.error('❌ فشل تسجيل الدخول في روبلوكس:', error.message);
    }
});


function parseNumber(str) {
    if (!str) return NaN;
    str = str.toLowerCase();
    let multiplier = 1;
    if (str.includes('k')) multiplier = 1000;
    else if (str.includes('m')) multiplier = 1000000;
    else if (str.includes('b')) multiplier = 1000000000;
    const num = parseFloat(str);
    return isNaN(num) ? NaN : num * multiplier;
}


const fs = require('fs');

// دالة تحميل آمنة عشان البوت ميفصلش لو الملفات مش موجودة
function loadData(filePath) {
    try {
        if (!fs.existsSync(filePath)) return {};
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        return {};
    }
}

let rpsData = loadData('./rpsData.json');
let salesLogs = loadData('./salesLogs.json');
let vipData = loadData('./vipData.json'); 

function saveStats() {
    fs.writeFileSync('./rpsData.json', JSON.stringify(rpsData, null, 4));
}

function saveLogs() {
    fs.writeFileSync('./salesLogs.json', JSON.stringify(salesLogs, null, 4));
}

function saveVips() {
    fs.writeFileSync('./vipData.json', JSON.stringify(vipData, null, 4));
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // هنا وضعت شرط التحقق للأونر فقط للأوامر الحساسة
    if (command === 'stock' || command === 'buy') {
        if (message.author.id !== ownerId) return message.reply('❌ هذا الأمر لصاحب البوت فقط!');
    }

    if (command === 'stock') {
        try {
            await message.channel.sendTyping();
            const userData = await getRobloxUser(cookie);
            const economyResponse = await axios.get(`https://economy.roblox.com/v1/users/${userData.id}/currency`, {
                headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
            });
            const stockEmbed = new EmbedBuilder()
                .setColor('#1b1d1f') 
                .setTitle('📋 | Robux Stock')
                .setDescription(`الكمية المتوفرة حالياً:\n\n` +
                                `\`${economyResponse.data.robux}\` Robux`)
                .setTimestamp()
                .setFooter({ text: 'تحديث فوري' });
            return message.reply({ embeds: [stockEmbed] });
        } catch (error) {
            console.error(error);
            return message.reply(`❌ فشل جلب الاستوك! تأكد من صلاحية الكوكيز.`);
        }
    }


// أمر !r (الأرقام الآن داخل ` ` لتسهيل النسخ)
    if (command === 'r') {
        const amount = parseNumber(args[0]);
        if (isNaN(amount) || amount <= 0) return message.reply('❌ يرجى تحديد كمية صحيحة.');

        const rawPrice = amount * pricePerUnit;
        const totalWithTax = Math.ceil(rawPrice / 0.95);

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('💰 | حاسبة الروبكس')
            .addFields(
                { name: 'الكمية المطلوبة', value: `\`${amount.toLocaleString('en-US', { useGrouping: false })}\` روبكس`, inline: true },
                { name: 'سعر الوحدة', value: `\`${pricePerUnit.toLocaleString('en-US', { useGrouping: false })}\` كريدت`, inline: true },
                { name: 'السعر الصافي', value: `\`${rawPrice.toLocaleString('en-US', { useGrouping: false })}\``, inline: false },
                { name: 'الإجمالي (بعد الضريبة)', value: `\`${totalWithTax.toLocaleString('en-US', { useGrouping: false })}\``, inline: false }
            )
            .setFooter({ text: 'ضريبة برو بوت: 5% | الأرقام محددة لسهولة النسخ' });

        return message.reply({ embeds: [embed] });
    }

// --- أمر -a للكريدت ---
    else if (command === 'a') {
        const credit = parseNumber(args[0]);
        if (isNaN(credit) || credit <= 0) return message.reply('❌ يرجى كتابة مبلغ الكريدت.');

        const canBuy = Math.floor((credit * 0.95) / pricePerUnit);
        
        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('🔄 | الحاسبة العكسية')
            .setDescription(`يمكنك شراء **${canBuy.toLocaleString()}** روبكس بالكريدت بعد خصم الضرائب`)
            .setFooter({ text: 'ضريبة برو بوت: 5% | الكريدت × 0.95' });
        return message.reply({ embeds: [embed] });
    }




else if (command === 'تحدي') {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('حجرة').setLabel('🪨 حجرة').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('ورقة').setLabel('📄 ورقة').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('مقص').setLabel('✂️ مقص').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('🎮 | تحدي البوت')
        .setDescription('اضغط على الزرار المناسب عشان تلعب ضد البوت!');

    const msg = await message.reply({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 30000 });

    collector.on('collect', async i => {
        if (i.user.id !== message.author.id) 
            return i.reply({ content: 'دي لعبة غيرك، العب في رسالة تانية!', ephemeral: true });

        const choices = ['حجرة', 'ورقة', 'مقص'];
        const botChoice = choices[Math.floor(Math.random() * choices.length)];
        const userChoice = i.customId;

        let result = '';
        let win = false;

        if (userChoice === botChoice) result = '🤝 تعادل!';
        else if ((userChoice === 'حجرة' && botChoice === 'مقص') || 
                 (userChoice === 'ورقة' && botChoice === 'حجرة') || 
                 (userChoice === 'مقص' && botChoice === 'ورقة')) {
            result = '🎉 مبروك، كسبت نقطة!';
            win = true;
        } else {
            result = '❌ خسرت، حظ أوفر!';
        }

        // تحديث النقاط (تأكد إن rpsData موجود ومعرف فوق في الكود)
        if (win) {
            rpsData[i.user.id] = (rpsData[i.user.id] || 0) + 1;
            saveStats(); // تأكد إن هذه الدالة تقوم بعمل fs.writeFileSync
        }

        // استجابة فورية للتفاعل لمنع فصل البوت
        await i.update({
            embeds: [new EmbedBuilder()
                .setColor(win ? '#00FF00' : '#FF0000')
                .setTitle('🎮 | نتيجة التحدي')
                .setDescription(`أنت اخترت: **${userChoice}**\nاختيار البوت: **${botChoice}**\n\n# ${result}\n\nرصيدك الحالي: **${rpsData[i.user.id] || 0}** فوز`)
            ],
            components: [] // حذف الأزرار بعد اللعب
        });
    });
}

else if (command === 'توب') {
    const sorted = Object.entries(rpsData).sort((a, b) => b[1] - a[1]).slice(0, 5);
    let text = sorted.map((v, i) => `${i + 1}. <@${v[0]}> : **${v[1]}** فوز`).join('\n');
    
    message.reply({ embeds: [new EmbedBuilder().setTitle('🏆 | قائمة المتصدرين').setDescription(text || 'لا يوجد فائزين بعد!')] });
}

// --- 1. أمر المحفظة (!bal) ---
else if (command === 'رصيد') {
    // بنقرأ مباشرة من المتغير الموجود في ذاكرة البوت
    const wins = rpsData[message.author.id] || 0;
    
    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle(`💳 | محفظة ${message.author.username}`)
        .setDescription(`عدد مرات الفوز: **${wins}** 🏆`);
    message.reply({ embeds: [embed] });
}

else if (command === 'شوب') {
    const prices = { 'buy_5': 100, 'buy_15': 250, 'buy_35': 350 };
    const rewards = { 'buy_5': 5, 'buy_15': 15, 'buy_35': 35 };

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('🛒 | متجر الروبكس')
        .setDescription('استبدل فوزك بروبكس:\n\n1️⃣ 5 روبكس (100 فوز)\n2️⃣ 15 روبكس (250 فوز)\n3️⃣ 35 روبكس (350 فوز)');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('buy_5').setLabel('شراء 5 روبكس').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('buy_15').setLabel('شراء 15 روبكس').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('buy_35').setLabel('شراء 35 روبكس').setStyle(ButtonStyle.Primary)
    );

    const msg = await message.reply({ embeds: [embed], components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async i => {
        if (i.user.id !== message.author.id) return i.reply({ content: 'دي مش رسالتك!', ephemeral: true });

        const cost = prices[i.customId];
        const userWins = rpsData[i.user.id] || 0;

        if (userWins < cost) {
            return i.reply({ content: `❌ رصيدك (فوز) غير كافٍ! تحتاج ${cost} فوز.`, ephemeral: true });
        }

       // --- داخل جزء الـ collect في أمر !شوب ---
// نولد كود عشوائي للفاتورة
const txID = Math.random().toString(36).substring(2, 10).toUpperCase();

const billEmbed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('🧾 | فاتورة شراء مؤكدة')
    .setThumbnail(i.user.displayAvatarURL()) // صورة العضو عشان التوثيق
    .addFields(
        { name: '👤 المشتري', value: `<@${i.user.id}>`, inline: true },
        { name: '🆔 كود العملية', value: `\`${txID}\``, inline: true },
        { name: '🎁 المنتج', value: `${rewards[i.customId]} روبكس`, inline: true },
        { name: '📉 الخصم', value: `${cost} فوز`, inline: true }
    )
    .setDescription(`\n⚠️ **ملاحظة:** هذه الفاتورة خاصة بـ ${i.user.username} فقط. أي محاولة لاستخدام فاتورة غيرك ستؤدي للحظر!`)
    .setFooter({ text: `توقيت العملية: ${new Date().toLocaleString()}` });

// داخل أمر الشوب، بعد الخصم:
rpsData[i.user.id] -= cost; 
saveStats(); // هنا الخصم هيتحفظ في الملف

salesLogs[txID] = { user: i.user.id, product: rewards[i.customId], status: 'جاري التنفيذ ⏳' };
saveLogs(); // هنا الفاتورة هتتحفظ في ملفها
await i.update({ embeds: [billEmbed], components: [] });
    });
}

else if (command === 'منافسة') {
    const opponent = message.mentions.users.first();
    if (!opponent) return message.reply('❌ لازم تعمل منشن للشخص اللي عايز تتحدى!');
    if (opponent.bot) return message.reply('🤖 لا يمكنك تحدي بوت!');
    if (opponent.id === message.author.id) return message.reply('⚠️ لا يمكنك تحدي نفسك!');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('accept').setLabel('قبول ✅').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('decline').setLabel('رفض ❌').setStyle(ButtonStyle.Danger)
    );

    const msg = await message.reply({ content: `⚔️ **${message.author}** يتحدى **${opponent}**!`, components: [row] });

    const collector = msg.createMessageComponentCollector({ time: 30000 });

    collector.on('collect', async i => {
        if (i.user.id !== opponent.id) return i.reply({ content: 'دي مش رسالتك!', ephemeral: true });
        if (i.customId === 'decline') return i.update({ content: '🚫 تم رفض التحدي.', components: [] });

        const gameRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rock').setLabel('🪨 حجرة').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('paper').setLabel('📄 ورقة').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('scissors').setLabel('✂️ مقص').setStyle(ButtonStyle.Secondary)
        );

        const gameMsg = await i.reply({ 
            content: `🎮 **الجولة بدأت!**\nعلى ${message.author} و ${opponent} اختيار حركتكم.`, 
            components: [gameRow],
            fetchReply: true 
        });

        const choices = new Map();
        const gameCollector = gameMsg.createMessageComponentCollector({ time: 60000 });

        gameCollector.on('collect', async g => {
            if (g.user.id !== message.author.id && g.user.id !== opponent.id) 
                return g.reply({ content: 'أنت مش طرف في التحدي!', ephemeral: true });
            
            if (choices.has(g.user.id)) 
                return g.reply({ content: 'لقد اخترت بالفعل!', ephemeral: true });

            choices.set(g.user.id, g.customId);
            await g.reply({ content: '✅ تم تسجيل اختيارك!', ephemeral: true });

            if (choices.size === 2) {
                gameCollector.stop();
                
                const p1 = message.author.id;
                const p2 = opponent.id;
                const c1 = choices.get(p1);
                const c2 = choices.get(p2);

                let winnerId = null;
                let result = '';

                if (c1 === c2) {
                    result = '🤝 تعادل!';
                } else if ((c1 === 'rock' && c2 === 'scissors') || (c1 === 'paper' && c2 === 'rock') || (c1 === 'scissors' && c2 === 'paper')) {
                    result = `🎉 الفائز هو <@${p1}>!`;
                    winnerId = p1;
                } else {
                    result = `🎉 الفائز هو <@${p2}>!`;
                    winnerId = p2;
                }

                if (winnerId) {
                    rpsData[winnerId] = (rpsData[winnerId] || 0) + 1;
                    saveStats();
                }

                const translate = { 'rock': '🪨 حجرة', 'paper': '📄 ورقة', 'scissors': '✂️ مقص' };

                await gameMsg.edit({ 
                    content: `🏁 **النتيجة:**\n<@${p1}>: **${translate[c1]}**\n<@${p2}>: **${translate[c2]}**\n\n# ${result}\n\n🏆 ${winnerId ? `تم إضافة فوز لـ <@${winnerId}>` : ''}`, 
                    components: [] 
                });
            }
        });
    });
}

// --- أمر الفحص (للأدمن والأونر) ---
else if (command === 'فحص') {
    // التأكد إن الشخص موجود في السيرفر وعنده صلاحيات
    if (!message.member) return message.reply('❌ هذا الأمر يعمل داخل السيرفرات فقط.');
    
    const isOwner = message.author.id === ownerId;
    const isAdmin = message.member.permissions.has('Administrator');

    if (!isAdmin && !isOwner) {
        return message.reply('❌ هذا الأمر للأدمن فقط!');
    }

    const code = args[0]?.toUpperCase();
    if (!code || !salesLogs[code]) return message.reply('❌ كود غير صحيح!');
    
    const log = salesLogs[code];
    message.reply(`🔍 **حالة الطلب:** ${code}\n**المشتري:** <@${log.user}>\n**الحالة:** ${log.status}`);
}

// --- أمر التسليم (للأونر فقط) ---
else if (command === 'تم') {
    // التأكد إنه الأونر فقط (باستخدام المتغير ownerId اللي عندك في سطر 17)
    if (message.author.id !== ownerId) {
        return message.reply('❌ هذا الأمر للأونر فقط!');
    }

    const code = args[0]?.toUpperCase();
    if (!code || !salesLogs[code]) return message.reply('❌ كود غير صحيح!');
    
    salesLogs[code].status = 'تم التسليم ✅';
    saveLogs();
    message.reply(`✅ تم تحديث الطلب ${code} بنجاح.`);
}


else if (command === 'ملفي') {
    const user = message.author;
    const member = message.member;
    const wins = rpsData[user.id] || 0;
    
    let rankInfo = { title: 'مبتدئ', icon: '🌱' };
    if (wins >= 1000) rankInfo = { title: 'أسطورة الروبكس', icon: '👑' };
    else if (wins >= 500) rankInfo = { title: 'محترف', icon: '🔥' };
    else if (wins >= 100) rankInfo = { title: 'مقاتل', icon: '⚔️' };

    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle(`📂 | سجل اللاعب`)
        .setThumbnail(message.guild.iconURL({ dynamic: true })) // هنا التعديل
        .setDescription(`
> **اللاعب:** <@${user.id}>
> **المستوى الحالي:** ${rankInfo.icon} **${rankInfo.title}**
> **إجمالي الانتصارات:** 🏆 \`${wins}\`
> **تاريخ الانضمام:** 📅 \`${member.joinedAt.toLocaleDateString()}\`

*ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ ـ*
**رسالة النظام:** ${wins < 100 ? 'أمامك طريق طويل يا بطل، واصل اللعب!' : 'أنت في مستوى النخبة، استمر في السيطرة!'}
        `)
        .setFooter({ text: 'Robux System | نظام الملفات', iconURL: message.guild.iconURL() });
        
    message.reply({ embeds: [embed] });
}

else if (command === 'اضافة') {
    // التأكد من الصلاحيات
    if (!message.member.permissions.has('ADMINISTRATOR')) return message.reply('❌ هذا الأمر للأونر فقط!');
    
    const target = message.mentions.members.first();
    const points = parseInt(args[1]);
    
    if (!target || !points) return message.reply('⚠️ الاستخدام: `-إضافة_نقاط @العميل 500`');

    // تحديث البيانات
    vipData[target.id] = (vipData[target.id] || 0) + points;
    
    // حفظ الملف بأمان
    try {
        fs.writeFileSync('./vipData.json', JSON.stringify(vipData, null, 2));
        message.reply(`✅ تم إضافة **${points}** نقطة لـ ${target.user.username}.`);
    } catch (err) {
        console.error('خطأ في حفظ الملف:', err);
        message.reply('❌ حدث خطأ أثناء حفظ النقاط!');
    }
}

else if (command === 'التوب') {
    // ترتيب العملاء حسب النقط
    const sortedVips = Object.entries(vipData).sort((a, b) => b[1] - a[1]).slice(0, 5);
    
let description = '';
    sortedVips.forEach((vip, index) => {
        // استبدل <ايموجي_الروبكس_هنا> بالكود اللي نسخته من الشات
        description += `${index + 1} | <@${vip[0]}> - نقاط: \`${vip[1]}\` <:Robux:1012124163462397952>\n`;
    });

    const embed = new EmbedBuilder()
        .setTitle('👑 | لوحة شرف كبار العملاء')
        .setDescription(description || 'لا يوجد عملاء بعد!')
        .setColor('#FFD700');
        
    message.reply({ embeds: [embed] });
}

else if (command === 'اخفاء') {
    if (!message.member.permissions.has('ADMINISTRATOR')) return message.reply('❌ للأدمن فقط!');

    const channel = message.channel; // القناة اللي بتكتب فيها الأمر
    channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: false })
        .then(() => message.reply('🚫 تم إخفاء القناة عن الأعضاء.'))
        .catch(err => message.reply('❌ حصل خطأ، تأكد من صلاحيات البوت!'));
}

else if (command === 'اظهار') {
    if (!message.member.permissions.has('ADMINISTRATOR')) return message.reply('❌ للأدمن فقط!');

    const channel = message.channel;
    channel.permissionOverwrites.edit(message.guild.id, { ViewChannel: true })
        .then(() => message.reply('✅ تم إظهار القناة للأعضاء.'))
        .catch(err => message.reply('❌ حصل خطأ، تأكد من صلاحيات البوت!'));
}

else if (command === 'ticket') {
    const channelName = `order-${message.author.username}`;
    message.guild.channels.create({
        name: channelName,
        type: 0, // Text Channel
        permissionOverwrites: [
            { id: message.guild.id, deny: ['ViewChannel'] },
            { id: message.author.id, allow: ['ViewChannel', 'SendMessages'] },
            { id: message.guild.roles.cache.find(r => r.name === 'Admin').id, allow: ['ViewChannel', 'SendMessages'] }
        ]
    }).then(channel => {
        message.reply(`تم فتح تذكرة خاصة بك في: ${channel}`);
        channel.send(`مرحباً ${message.author}، الإدارة ستصلك قريباً. يرجى كتابة تفاصيل طلبك.`);
    });
}


// --- جوه الجزء الخاص بالأوامر ---

if (command === 'egp') {
    const amount = parseFloat(args[0]);
    if (!amount) return message.reply('استخدم: -egp [المبلغ]');
    
    const result = (amount / pricePerRobux).toFixed(0);
    
    const embed = new EmbedBuilder()
        .setTitle('حاسبة التحويل')
        .setDescription(`المبلغ ${amount} جنيه يوفر لك: **${result} Robux**`)
        .setColor('#2b2d31');

    message.reply({ embeds: [embed] });
}

else if (command === 'rbx') {
    const amount = parseFloat(args[0]);
    if (!amount) return message.reply('استخدم: -rbx [عدد الروبكس]');
    
    // استخدام Math.round للجنيه عشان يشيل الفواصل، و toFixed(1) للكريبتو
    const priceInEGP = Math.round(amount * pricePerRobux);
    const priceInCrypto = (amount * cryptoRate).toFixed(1); 
    
    const embed = new EmbedBuilder()
        .setTitle('حاسبة تحويل الروبوكس')
        .setDescription(`
الكمية: ${amount} Robux

بالمصري: ${priceInEGP} EGP
بالكريبتو: $${priceInCrypto} USDT
        `)
        .setColor('#2b2d31');

    message.reply({ embeds: [embed] });
}

    else if (command === 'usdt') {
    const amount = parseFloat(args[0]);
    if (!amount) return message.reply('استخدم: -usdt [المبلغ بالدولار]');
    
    const robuxAmount = Math.round(amount / cryptoRate);
    
    const embed = new EmbedBuilder()
        .setTitle('حاسبة تحويل الكريبتو')
        .setDescription(`
مبلغ $${amount} يوفر لك:

${robuxAmount} Robux
        `)
        .setColor('#2b2d31');

    message.reply({ embeds: [embed] });
}

if (message.content.startsWith(prefix + 'tax')) {
    const args = message.content.split(' ');
    const amount = parseInt(args[1]);

    if (!amount || isNaN(amount)) return message.reply('❌ اكتب المبلغ!');

    const profit = Math.floor(amount * 0.7);
    const needed = Math.ceil(amount / 0.7);

    const embed = new EmbedBuilder()
        .setTitle('💰 حاسبة روبلوكس')
        .setDescription(`**المبلغ:** ${amount} Robux\n\n**يصلك صافي:** ${profit}\n**للبيع بـ صافي:** ${needed}`)
        .setColor('#00ff00');

    message.channel.send({ embeds: [embed] });
}

    else if (command === 'say') {
    if (!message.member.permissions.has('Administrator')) return;
    const text = args.join(' ');
    if (!text) return message.reply('اكتب الرسالة');
    
    message.delete();
    message.channel.send(text);
}

else if (command === 'امبيد') {
    if (!message.member.permissions.has('Administrator')) return;
    const text = args.join(' ');
    if (!text) return message.reply('اكتب الرسالة');
    
    const embed = new EmbedBuilder()
        .setTitle('Handom Robux') // عنوان ثابت وشيك
        .setDescription(text)    // الرسالة اللي إنت بتكتبها بتظهر هنا
        .setColor('#2b2d31');
    
    message.delete();
    message.channel.send({ embeds: [embed] });
}


else if (command === 'help') {
    const helpEmbed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('Handom Robux - مركز المساعدة')
        .setDescription('مرحباً بك! هذه قائمة الأوامر المنظمة لخدمات السيرفر:')
        .addFields(
            { 
                name: 'خدمات التجارة والحسابات', 
                value: '`-r [الكمية]` : حاسبة الروبكس\n`-a [الكريدت]` : الحاسبة العكسية\n`-egp [المبلغ]` : تحويل الجنيه لروبكس\n`-usdt [المبلغ]` : تحويل الدولار لروبكس\n`-rbx [العدد]` : تحويل الروبكس للعملات\n`-التوب` : لوحة شرف كبار العملاء', 
                inline: false 
            },
            { 
                name: 'نظام التحديات والجوائز', 
                value: '`-تحدي` : العب ضد البوت\n`-منافسة @user` : تحدي صديقك\n`-رصيد` : عرض محفظتك\n`-شوب` : استبدال الفوز بروبكس\n`-توب` : قائمة متصدري الألعاب', 
                inline: false 
            },
            { 
                name: 'أوامر التحكم والإدارة', 
                value: '`-stock` : عرض الرصيد المتوفر\n`-ملفي` : سجل إنجازاتك\n`-فحص [الكود]` : فحص حالة طلبك\n`-تم [الكود]` : تسليم الطلب (أونر)\n`-اضافة @user [النقاط]` : إضافة نقاط (أدمن)', 
                inline: false 
            }
        )
        .setThumbnail(message.guild.iconURL({ dynamic: true }))
        .setFooter({ text: 'Handom Robux | تجارة آمنة وسريعة', iconURL: message.client.user.displayAvatarURL() })
        .setTimestamp();

    return message.reply({ embeds: [helpEmbed] });
}

    if (command === 'buy') {
        const gamepassId = args[0];
        const price = args[1];
        if (!gamepassId || !price || isNaN(price)) {
            return message.reply('❌ اكتب الأمر صح: \`-buy [رقم الجيم باس] [السعر]\`');
        }
        try {
            await message.channel.sendTyping();
            const loadingMsg = await message.reply('🔄 جاري التحقق من الجيم باس وسحب الروبوكس...');
            const productResponse = await axios.get(`https://apis.roblox.com/game-passes/v1/game-passes/${gamepassId}/product-info`);
            const productId = productResponse.data.ProductId;
            const gamepassName = productResponse.data.Name || 'Roblox Pass';
            const sellerId = productResponse.data.Creator.Id;
            if (!productId || !sellerId) {
                await loadingMsg.delete();
                return message.reply('❌ لم يتم العثور على بيانات هذا الجيم باس!');
            }
            const result = await buyGamepassDirect(cookie, productId, price, sellerId);
            if (result.purchased === true) {
                await loadingMsg.delete();
                const imageBuffer = await createRobloxInvoice(gamepassName, message.author.username, price, gamepassId);
                const attachment = new AttachmentBuilder(imageBuffer, { name: 'roblox-invoice.png' });
                return message.reply({ 
                    content: `✅ **تم الشراء بنجاح وتوليد الفاتورة الأصلية:**`,
                    files: [attachment] 
                });
            } else {
                await loadingMsg.delete();
                let reason = result.reason || 'الطلب مرفوض من سيرفرات روبلوكس';
                if (reason === 'AlreadyOwned') reason = 'أنت تملك هذا الجيم باس بالفعل!';
                return message.reply(`❌ **فشلت العملية:** \`${reason}\``);
            }
        } catch (error) {
            console.error(error);
            let errMsg = error.message;
            if (error.response && error.response.data && error.response.data.errors) {
                errMsg = error.response.data.errors[0].message;
            }
            return message.reply(`❌ **خطأ أثناء الشراء:** \`${errMsg}\``);
        }
    }
});

client.login(token);
