// @flow
import React, { Component } from 'react';
import {
    FlatButton, AppBar, SelectField, MenuItem, Toggle,
    Slider, AutoComplete, TimePicker, IconButton, SvgIcon,
    CircularProgress,
    Card, CardText, CardHeader,
} from 'material-ui'

import injectTapEventPlugin from 'react-tap-event-plugin'
import moment from 'moment'
import FacebookProvider, { Login } from 'react-facebook'
import Download from 'material-ui/svg-icons/file/file-download'
import RefreshIcon from 'material-ui/svg-icons/navigation/refresh'

import { EventsModal, ParticipantModal, CalendarModal, AlmedDrawer, Map } from './components'
import { Events, Favorites } from './services'
import EventsTable from "./components/eventsTable"
import { isMobile } from './constants'

// Needed for onTouchTap
// http://stackoverflow.com/a/34015469/988941
injectTapEventPlugin()

type Appstate = {
    points: Array<AlmedEvent>,
    filteredPoints: Array<AlmedEvent>,
    participantsMap: {[key: string]: [AlmedParticipant, number]},
    choosenPoint?: ?AlmedEvent,

    nonColliding?: boolean,
    inFuture: boolean,
    choosenParticipant?: AlmedParticipant,
    subjectsObject?: {[key: string]: number},
    choosenSubjectIndex?: ?number,
    choosenDay?: ?string,
    choosenDayEnd?: ?string,

    unixSecondsMax?: number,
    unixSecondsMin?: number,
    choosenUnixSecondsMax?: number,
    choosenUnixSecondsMin?: number,

    food?: boolean,
}

const FBIcon = (props) => (
    <SvgIcon {...props}>
        <path d="M5,3H19A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3M18,5H15.5A3.5,3.5 0 0,0 12,8.5V11H10V14H12V21H15V14H18V11H15V9A1,1 0 0,1 16,8H18V5Z" />
    </SvgIcon>
);

function saveToDisk(text: string, name: string = 'favorites.txt', type: string = 'text/plain') {
    var a = document.createElement("a");
    var file = new Blob([text], {type: type});
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
}

class App extends Component {
    state: Appstate = {
        points: [],
        filteredPoints: [],
        participantsMap: {},
        inFuture: true,
    }

    componentWillMount() {
        this.setPoints()
    }

    async setPoints() {
        let events = Events.getPersistentEvents() || []
        if (!events.length) {
            events = await Events.saveData() || []
        }
        try {
            await Favorites.getRemoteFavoritesMerged()
        } catch(err) {
            console.warn('could not get remote favs', err)
        }

        this.setState({ points: Events.getPersistentEvents() }, () => this.setup())
    }

    setup() {
        const { points } = this.state
        const filteredPoints = this.filterPoints()
        const subjectsObject = {}
        const times = []
        const participantsMap: {[key: string]: [AlmedParticipant, number]} = {}
        filteredPoints.forEach((point) => {
            if (point.subject && point.subject.length) {
                point.subject.forEach(sub => {
                    subjectsObject[sub] = subjectsObject[sub] ? subjectsObject[sub] + 1 : 1
                })
            }
            if (point.participants && point.participants.length) {
                point.participants.forEach(part => {
                    const p: ?[AlmedParticipant, number] = participantsMap[part.name]
                    if (p) {
                        participantsMap[part.name] = [part, (p[1] || 0) + 1]
                    } else {
                        participantsMap[part.name] = [part, 1]
                    }
                })

            }
            if (point.date) {
                const d = Math.round(new Date(point.date).getTime()/1000)
                if (!isNaN(d)) times.push(d)
            }
        })

        console.log('participantsMap', participantsMap)
        let d = {}
        if (times.length) {
            d = {
                unixSecondsMin: Math.min(...times),
                unixSecondsMax: Math.max(...times),
            }
        }


        this.setState({
            points,
            filteredPoints,
            participantsMap,
            subjectsObject,
            ...d,
            choosenUnixSecondsMin: d.unixSecondsMin ? d.unixSecondsMin : 0,
            choosenUnixSecondsMax: d.unixSecondsMax ? d.unixSecondsMax : Infinity,
        })
    }

    map: any
    async downloadSaveData(): Promise<void> {
        const allData = await Events.saveData()
        this.setState({ points: allData })
    }

    filterPoints() {
        const { points, choosenSubjectIndex, subjectsObject, choosenDay, choosenDayEnd, nonColliding, inFuture,
            choosenUnixSecondsMin, choosenUnixSecondsMax, food } = this.state
        const subjects: Array<string> = Object.keys(subjectsObject || {}).sort()
        const choosenSubject: ?string = choosenSubjectIndex && subjects ? subjects[choosenSubjectIndex] : null

        const favs = Favorites.all()
        const res = points.filter((point: AlmedEvent) => {
            let keep = choosenSubject ? point.subject === choosenSubject : true
            if (point.date) {
                const time = new Date(point.date).getTime()/1000
                if (choosenUnixSecondsMin) {
                    keep = keep && choosenUnixSecondsMin < time
                }
                if (choosenUnixSecondsMax) {
                    keep = keep && choosenUnixSecondsMax > time
                }
            }

            if (food) {
                keep = keep && point.food
            }

            if (nonColliding) {
                keep = keep && !favs.some((fav: AlmedEvent) => {
                    if (!fav.date || !fav.endDate || !point.date || !point.endDate) {
                        return false
                    }
                    const start1 = (new Date(fav.date)).getTime()
                    const end1 = (new Date(fav.endDate || '')).getTime()
                    const start2 = (new Date(point.date || '')).getTime()
                    const end2 = (new Date(point.endDate  || '')).getTime()
                    return Math.max(start1, start2) < Math.min(end1, end2)
                })
            }

            if (inFuture) {
                keep = keep && moment(point.endDate).isAfter(moment())
            }

            const d = moment(point.date)
            if (choosenDay) {
                keep = keep && d.isAfter(choosenDay)
            }

            if (choosenDayEnd) {
                keep = keep && d.isBefore(choosenDayEnd)
            }

            return keep
        })
        // console.log('choosenSubjectIndex', choosenSubjectIndex, res, choosenSubject)

        return res
    }

    renderSubjectSelect() {
        const { subjectsObject, choosenSubjectIndex, points } = this.state
        const subjects = Object.keys(subjectsObject || {}).sort()
        return subjects && <SelectField
            floatingLabelText="Ämnen"
            value={choosenSubjectIndex}
            onChange={(event, newChoosenSubjectIndex, value) => {
                console.log('newChoosenSubjectIndex', value)
                return this.setState({
                    choosenSubjectIndex: value,
                })
            }}
        >
            <MenuItem
                primaryText={`Alla - ${points.length}`}
                value={null}
            />
            {subjects.map((subject, index) => <MenuItem
                key={subject}
                value={index}
                primaryText={`${subject} - ${subjectsObject ? subjectsObject[subject] : ''}`}
            />)}
        </SelectField>
    }

    renderParticipants() {
        const { participantsMap } = this.state
        const participants = Object.keys(participantsMap).sort().map(key => participantsMap[key][0])
        const getP = (part) => `${part.name} - ${participantsMap ? participantsMap[part.name][1] : ''}`
        return <div
            style={{ display: 'flex' }}
        >
            <ParticipantModal participantsMap={participantsMap} />
            <AutoComplete
                hintText="Deltagare"
                dataSource={participants.map(getP)}
                onUpdateInput={(e, a, b)=> console.log('debug',e, a, b)}
                filter={(searchText: string, key) => searchText.length > 2 && searchText.toLowerCase() !== '' && key.toLowerCase().indexOf(searchText) !== -1}
            />
        </div>
    }

    renderTimeSelectors() {
        const { unixSecondsMax, unixSecondsMin,
            choosenUnixSecondsMax, choosenUnixSecondsMin,
        } = this.state
        const format = 'HH:mm dddd DD/MM'
        const minTime = unixSecondsMin && Date.now()/1000 > unixSecondsMin ? Date.now()/1000 : unixSecondsMin
        return <div>
            <h4>Tid</h4>
            <p>Min tid</p>
            <Slider
                style={{ margin: '1em' }}
                min={minTime}
                max={unixSecondsMax}
                step={3600}
                value={choosenUnixSecondsMin || unixSecondsMin}
                onChange={(e, time) => this.setState({ choosenUnixSecondsMin: time })}
            />
            {choosenUnixSecondsMin && moment(choosenUnixSecondsMin * 1000).format(format)}
            <p>Max tid</p>
            <Slider
                style={{ margin: '1em' }}
                min={minTime}
                max={unixSecondsMax}
                step={3600}
                value={choosenUnixSecondsMax || unixSecondsMax}
                onChange={(e, time: number) => this.setState({ choosenUnixSecondsMax: time })}
            />
            {choosenUnixSecondsMax && moment(choosenUnixSecondsMax * 1000).format(format)}
        </div>
    }

    renderDaySelector() {
        const { points, choosenDay, choosenDayEnd } = this.state
        const format = 'YYYY-MM-DDTHH:mm:ss'
        const days = (points || [])
            .reduce((acc, point) => {
                if (point.date && !acc[moment(point.date, format).startOf('day').format()]) {
                    acc[moment(point.date, format).startOf('day').format()] = true
                }
                return acc
            }, {})
        const dayKeys = Object.keys(days)
        // const labelColor = {
        //     // color:'white',
        //     // WebkitTextFillColor: 'white',
        //     // WebkitTapHighlightColor: 'white',
        // }
        return <div style={{ display: 'flex' }}>
            {!!dayKeys.length && <SelectField
                key={'date'}
                floatingLabelText="Day"
                value={choosenDay}
                onChange={(e, index, value) => {
                    let state = {
                        choosenDay: null,
                        choosenDayEnd: null,
                    }
                    if (value) {
                        state.choosenDay = value
                        state.choosenDayEnd = moment(value).endOf('day').format()
                    }
                    console.log('did set date', state)
                    this.setState(state, () => this.setup())

                }}
            >
                <MenuItem key={'alla'} value={null} primaryText={'All days'} />
                {dayKeys.map((key) => <MenuItem key={key} value={key} primaryText={moment(key).format('dddd DD/MM')} />)}
            </SelectField>}
            <div>
            {!!choosenDay &&
                <TimePicker
                    key={'startDate'}
                    format="24hr"
                    value={new Date(choosenDay)}
                    onChange={(e, value) => this.setState({ choosenDay: moment(value).format() }, () => this.setup())}
                />}
            {!!choosenDayEnd && <TimePicker
                key={'endDate'}
                format="24hr"
                value={new Date(choosenDayEnd)}
                onChange={(e, value) => this.setState({ choosenDayEnd: moment(value).format() }, () => this.setup())}
            />}
            </div>
        </div>
    }

    async handleFacebookLoginResponse(data: FacebookLoginData) {
        console.log(data, JSON.stringify(data))
        const token = data.tokenDetail.accessToken
        localStorage.setItem(Favorites.fbToken, token)
        await Favorites.auth(token)
    }

    renderFacebookLogin() {
        return <FacebookProvider appId="512783022397010">
            <Login
                scope="email"
                onResponse={(data) => this.handleFacebookLoginResponse(data)}
                onError={(error) => console.log('debug', error)}
                render={({ isLoading, isWorking, onClick }) => isLoading ? <CircularProgress /> : <IconButton
                    tooltip="Login with facebook to sync favorites"
                    onClick={onClick}
                >
                    <FBIcon color="white" />
                </IconButton>}
            >
                <span>Login via Facebook</span>
            </Login>
        </FacebookProvider>
    }

    renderToggles() {
        const styles = {
            block: {
                maxWidth: 250,
            },
            toggle: {
                marginBottom: 16,
            },
            thumbOff: {
                backgroundColor: '#ffcccc',
            },
            trackOff: {
                backgroundColor: '#ff9d9d',
            },
            thumbSwitched: {
                backgroundColor: 'red',
            },
            trackSwitched: {
                backgroundColor: '#ff9d9d',
            },
            labelStyle: {
                color: 'red',
            },
        };
        return <div>
            <IconButton tooltip="Only show events not colliding with your favorites">
                <Toggle
                    style={{ width: 20 }}
                    label="Non colliding"
                    onToggle={(e, value) => this.setState({ nonColliding: value }, () => this.setup())}
                    thumbStyle={styles.thumbOff}
                    trackStyle={styles.trackOff}
                    thumbSwitchedStyle={styles.thumbSwitched}
                    trackSwitchedStyle={styles.trackSwitched}
                    labelStyle={styles.labelStyle}
                />
            </IconButton>
            <IconButton tooltip="Only show future seminars">
                <Toggle
                    style={{ width: 20 }}
                    defaultToggled={true}
                    label="In the future"
                    onToggle={(e, value) => this.setState({ inFuture: value }, () => this.setup())}
                    thumbStyle={styles.thumbOff}
                    trackStyle={styles.trackOff}
                    thumbSwitchedStyle={styles.thumbSwitched}
                    trackSwitchedStyle={styles.trackSwitched}
                    labelStyle={styles.labelStyle}
                />
            </IconButton>
        </div>
    }

    renderAppBar(filteredPoints: Array<AlmedEvent>) {
        const { participantsMap, points } = this.state

        const content = <div>
            <div>Seminars in store {points.length}</div>
            <div>Seminars showing {filteredPoints.length}</div>
            {this.renderDaySelector()}
            {this.renderToggles()}
            <FlatButton
                label={'Update'}
                onClick={() => this.downloadSaveData()}
            />
            <Map points={Favorites.all()} modal={true} button={true} />,
            <ParticipantModal participantsMap={participantsMap}/>
            <EventsModal events={filteredPoints}/>
            <CalendarModal events={filteredPoints}/>
            <FlatButton
                label={'Download as file'}
                onClick={() => saveToDisk(JSON.stringify(Favorites.all()))}
            />
            {this.renderFacebookLogin()}
        </div>

        const barContent = [
            this.renderToggles(),
            <div style={{ width: '2em' }}></div>,
            <IconButton
                onClick={() => this.downloadSaveData()}
                tooltip="Update events from server"
            >
                <RefreshIcon color="white" />
                </IconButton>,
            <Map points={Favorites.all()} modal={true} />,
            <ParticipantModal participantsMap={participantsMap} iconButton={true} />,
            <EventsModal events={filteredPoints} iconButton={true} />,
            <CalendarModal events={filteredPoints} iconButton={true} />,
            <IconButton
                tooltip="Download favorites as file"
                onClick={() => saveToDisk(JSON.stringify(Favorites.all()))}
            >
                <Download color="white" />
            </IconButton>,
            this.renderFacebookLogin(),
        ]

        return <AppBar
            title={`Almedalen with ${points.length} seminars`}
            iconElementLeft={<AlmedDrawer content={content} />}
            iconElementRight={<div style={{ display: 'flex' }}>
                {!isMobile && barContent}
            </div>}
        />
    }

    render() {
        const { points, filteredPoints } = this.state
        const futurePoints = points.filter(sem => moment(sem.date).isAfter(moment()))
        const pastPoints = points.filter(sem => moment(sem.date).isBefore(moment()))
        return <div>
            {this.renderAppBar(filteredPoints)}
            <EventsTable
                events={futurePoints}
                onlyFavs={true}
                defaultSort="time"
            />
            <Card>
                <CardHeader
                    title="Past events"
                    actAsExpander={true}
                    showExpandableButton={true}
                />
                <CardText expandable={true}>
                    <EventsTable
                        events={pastPoints}
                        onlyFavs={true}
                        defaultSort="time"
                    />
                </CardText>
            </Card>
        </div>
    }
}

export default App;
