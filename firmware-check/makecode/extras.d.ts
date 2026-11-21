type int32 = number; type uint32 = number; type int16 = number; type uint16 = number; type int8 = number; type uint8 = number; type float = number; type double = number; type Action = () => void; type RefAction = Action;
declare namespace music { function playTone(frequency: number, ms: number): void; function rest(ms: number): void; }
declare namespace basic { function showIcon(icon: IconNames, interval?: number): void; }
declare namespace bluetooth { function uartWriteString(data: string): void; function uartReadUntil(del: string): string; }
declare namespace serial { function delimiters(del: Delimiters): string; }
interface Math { idiv(x: number, y: number): number; }
declare const enum Delimiters {
    //% block="new line (\n)"
    NewLine = 10,
    //% block=","
    Comma = 44,
    //% block="$"
    Dollar = 36,
    //% block=":"
    Colon = 58,
    //% block="."
    Fullstop = 46,
    //% block="#"
    Hash = 35,
    //% block="carriage return (\r)"
    CarriageReturn = 13,
    //% block="space"
    Space = 32,
    //% block="tab (\t)"
    Tab = 9,
    //% block="|"
    Pipe = 124,
    //% block=";"
    SemiColon = 59,
}
declare const enum IconNames {
    //% block="heart"
    //% jres=icons.heart
    Heart = 0,
    //% block="small heart"
    //% jres=icons.smallheart
    SmallHeart,
    //% block="yes"
    //% jres=icons.yes
    Yes,
    //% block="no"
    //% jres=icons.no
    No,
    //% block="happy"
    //% jres=icons.happy
    Happy,
    //% block="sad"
    //% jres=icons.sad
    Sad,
    //% block="confused"
    //% jres=icons.confused
    Confused,
    //% block="angry"
    //% jres=icons.angry
    Angry,
    //% block="asleep"
    //% jres=icons.asleep
    Asleep,
    //% block="surprised"
    //% jres=icons.surprised
    Surprised,
    //% block="silly"
    //% jres=icons.silly
    Silly,
    //% block="fabulous"
    //% jres=icons.fabulous
    Fabulous,
    //% block="meh"
    //% jres=icons.meh
    Meh,
    //% block="t-shirt"
    //% jres=icons.tshirt
    TShirt,
    //% block="roller skate"
    //% jres=icons.rollerskate
    Rollerskate,
    //% block="duck"
    //% jres=icons.duck
    Duck,
    //% block="house"
    //% jres=icons.house
    House,
    //% block="tortoise"
    //% jres=icons.tortoise
    Tortoise,
    //% block="butterfly"
    //% jres=icons.butterfly
    Butterfly,
    //% block="stick figure"
    //% jres=icons.stickfigure
    StickFigure,
    //% block="ghost"
    //% jres=icons.ghost
    Ghost,
    //% block="sword"
    //% jres=icons.sword
    Sword,
    //% block="giraffe"
    //% jres=icons.giraffe
    Giraffe,
    //% block="skull"
    //% jres=icons.skull
    Skull,
    //% block="umbrella"
    //% jres=icons.umbrella
    Umbrella,
    //% block="snake"
    //% jres=icons.snake
    Snake,
    //% block="rabbit"
    //% jres=icons.rabbit
    Rabbit,
    //% block="cow"
    //% jres=icons.cow
    Cow,
    //% block="quarter note"
    //% jres=icons.quarternote
    QuarterNote,
    //% block="eigth note"
    //% jres=icons.eighthnote
    //% deprecated=true blockHidden=true
    EigthNote,
    //% block="eighth note"
    //% jres=icons.eighthnote
    EighthNote,
    //% block="pitchfork"
    //% jres=icons.pitchfork
    Pitchfork,
    //% block="target"
    //% jres=icons.target
    Target,
    //% block="triangle"
    //% jres=icons.triangle
    Triangle,
    //% block="left triangle"
    //% jres=icons.lefttriangle
    LeftTriangle,
    //% block="chess board"
    //% jres=icons.chessboard
    Chessboard,
    //% block="diamond"
    //% jres=icons.diamond
    Diamond,
    //% block="small diamond"
    //% jres=icons.smalldiamond
    SmallDiamond,
    //% block="square"
    //% jres=icons.square
    Square,
    //% block="small square"
    //% jres=icons.smallsquare
    SmallSquare,
    //% block="scissors"
    //% jres=icons.scissors
    Scissors
}
