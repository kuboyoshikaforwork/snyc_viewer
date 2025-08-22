// Props定義
type Props = {
  labelName: string;
  onClick: () => void;
};

// スタイル定義
const buttonStyle = {
  paddingRight: '10px',
  paddingLeft: '10px',
  marginTop: '5px',
  marginBottom: '5px',
  marginRight: '2px',
  marginLeft: '2px',
};

const CustomButton = (props: Props) => {
  return (
    <>
      <button style={buttonStyle} type="button" onClick={props.onClick}>
        {props.labelName}
      </button>
    </>
  );
};
export default CustomButton;
