// Telegram WebApp API ကို စတင်ခေါ်ယူခြင်း
const tg = window.Telegram.WebApp;

// မျက်နှာပြင် အပြည့် (Full Height) အလိုအလျောက်ပွင့်လာအောင် လုပ်ခြင်း
tg.expand();

// ခလုတ်နှိပ်လိုက်လျှင် Bot ဆီ Text စာသား လှမ်းပို့ပေးမည့် လုပ်ဆောင်ချက်
function sendAction(actionText) {
    if (actionText) {
        // Telegram Bot ထံသို့ စာသားပို့လိုက်ခြင်း
        tg.sendData(actionText);
    }
}
